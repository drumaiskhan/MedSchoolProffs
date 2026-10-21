import { Router, type IRouter, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, usersTable, bookHighlightsTable, bookBookmarksTable, bookReadingProgressTable, auditLogsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import { resolveBookAccess } from "../lib/bookAccess";
import { checkRateLimit } from "../lib/rateLimit";
import { logger } from "../lib/logger";
import {
  BookUnavailableError, NotPdfError, fileKeyOf, getOutline, getPageSizes, getPageWords, loadBook, renderPageJpeg, searchBook, type Watermark,
} from "../lib/bookReader";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Secure book reader API. See lib/bookReader.ts for the design: the student
// never gets the PDF, only watermarked page pictures + word boxes.
// ---------------------------------------------------------------------------

const NO_STORE = "private, no-store, max-age=0";

function fail(res: Response, err: unknown): void {
  if (err instanceof NotPdfError) { res.status(415).json({ error: err.message }); return; }
  if (err instanceof BookUnavailableError) { res.status(502).json({ error: err.message }); return; }
  if (err instanceof RangeError) { res.status(404).json({ error: "Page not found" }); return; }
  logger.error({ err }, "[book-reader] unexpected failure");
  res.status(500).json({ error: "The reader hit a problem. Please try again." });
}

async function watermarkFor(userId: number): Promise<Watermark> {
  const [u] = await db.select({ name: usersTable.name, email: usersTable.email }).from(usersTable).where(eq(usersTable.id, userId));
  const ascii = (s: string) => /^[\x20-\x7E]+$/.test(s);
  const date = new Date().toISOString().slice(0, 10);
  const who = u?.email ?? `user ${userId}`;
  return {
    primary: `${who}  ·  ID ${userId}`,
    secondary: `Licensed to ${u?.name && ascii(u.name) ? `${u.name} · ` : ""}${who} · ID ${userId} · ${date} · Do not copy or share`,
  };
}

const idOf = (v: string | string[] | undefined): number | null => { const n = Number(Array.isArray(v) ? v[0] : v); return Number.isInteger(n) && n > 0 ? n : null; };

// Small LRU of already-rendered pages per (user, book, page, width) so scrolling
// back over pages doesn't re-render them. Per-user because the watermark is.
const imageCache = new Map<string, { buf: Buffer; at: number }>();
const IMAGE_CACHE_MAX_BYTES = 60 * 1024 * 1024;
let imageCacheBytes = 0;
function cachePut(key: string, buf: Buffer): void {
  imageCache.set(key, { buf, at: Date.now() });
  imageCacheBytes += buf.byteLength;
  while (imageCacheBytes > IMAGE_CACHE_MAX_BYTES && imageCache.size > 1) {
    const oldest = imageCache.keys().next().value as string;
    imageCacheBytes -= imageCache.get(oldest)!.buf.byteLength;
    imageCache.delete(oldest);
  }
}
function cacheGet(key: string): Buffer | null {
  const hit = imageCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > 10 * 60 * 1000) { imageCacheBytes -= hit.buf.byteLength; imageCache.delete(key); return null; }
  imageCache.delete(key); imageCache.set(key, hit); // refresh recency
  return hit.buf;
}

// ---- Reader info -------------------------------------------------------------
router.get("/books/:id/reader", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  if (!bookId) { res.status(400).json({ error: "Invalid book" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const limit = checkRateLimit(`bookopen:${req.user!.id}`, 60, 60 * 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "You've opened a lot of books in a short time. Please try again later." }); return; }
  try {
    const book = await loadBook(access.book.storagePath);
    const sizes = await getPageSizes(book);
    const [progress] = await db.select().from(bookReadingProgressTable).where(and(eq(bookReadingProgressTable.userId, req.user!.id), eq(bookReadingProgressTable.bookId, bookId)));
    await db.insert(auditLogsTable).values({ actorId: req.user!.id, action: "BOOK_READER_OPENED", entity: "book", entityId: bookId });
    res.set("Cache-Control", NO_STORE).json({
      id: access.book.id, title: access.book.title, author: access.book.author, isFree: access.book.isFree,
      pageCount: book.pageCount, pages: sizes, resumePage: Math.min(Math.max(progress?.page ?? 1, 1), book.pageCount),
      fileKey: fileKeyOf(access.book.storagePath),
    });
  } catch (err) { fail(res, err); }
});

// ---- Page image ---------------------------------------------------------------
router.get("/books/:id/pages/:page/image", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id), page = idOf(req.params.page);
  if (!bookId || !page) { res.status(400).json({ error: "Invalid request" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  // Two brakes on scraping a whole book: a per-minute burst limit (a person
  // scrolling fast stays well under it) and a daily ceiling per book.
  const burst = checkRateLimit(`bookpage-burst:${req.user!.id}`, 90, 60 * 1000);
  const daily = checkRateLimit(`bookpage-day:${req.user!.id}:${bookId}`, 4000, 24 * 60 * 60 * 1000);
  if (!burst.allowed || !daily.allowed) { res.status(429).json({ error: "Too many pages requested. Slow down and try again shortly." }); return; }
  const width = Math.min(1600, Math.max(600, Number(req.query.w) || 1000));
  const cacheKey = `${req.user!.id}:${bookId}:${fileKeyOf(access.book.storagePath)}:${page}:${Math.round(width / 100)}`;
  try {
    let buf = cacheGet(cacheKey);
    if (!buf) {
      const book = await loadBook(access.book.storagePath);
      buf = await renderPageJpeg(book, page, width, await watermarkFor(req.user!.id));
      cachePut(cacheKey, buf);
    }
    res.set({ "Content-Type": "image/jpeg", "Cache-Control": NO_STORE, Pragma: "no-cache", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" }).send(buf);
  } catch (err) { fail(res, err); }
});

// ---- Word boxes ----------------------------------------------------------------
router.get("/books/:id/pages/:page/words", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id), page = idOf(req.params.page);
  if (!bookId || !page) { res.status(400).json({ error: "Invalid request" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  try {
    const book = await loadBook(access.book.storagePath);
    res.set("Cache-Control", NO_STORE).json({ page, words: await getPageWords(book, page) });
  } catch (err) { fail(res, err); }
});

// ---- Highlights ------------------------------------------------------------------
// Original colour names (kept for older highlights) or a #rrggbb hex from the reader's palette / colour picker.
const ColorSchema = z.string().regex(/^(yellow|green|pink|blue|#[0-9a-fA-F]{6})$/);
const HighlightBody = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("words"), page: z.number().int().min(1), startWord: z.number().int().min(0), endWord: z.number().int().min(0), color: ColorSchema.optional(), note: z.string().max(1000).nullable().optional() }),
  z.object({ kind: z.literal("area"), page: z.number().int().min(1), rect: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1), w: z.number().min(0.005).max(1), h: z.number().min(0.005).max(1) }), color: ColorSchema.optional(), note: z.string().max(1000).nullable().optional() }),
  // Freehand pen stroke: points in 0..1 page coordinates, width as a fraction of page width. Stored as JSON in the `rect` column.
  z.object({ kind: z.literal("ink"), page: z.number().int().min(1), ink: z.object({ pts: z.array(z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])).min(1).max(800), w: z.number().min(0.0005).max(0.05) }), color: ColorSchema.optional(), note: z.string().max(1000).nullable().optional() }),
]);

function highlightView(h: typeof bookHighlightsTable.$inferSelect) {
  return { id: h.id, page: h.page, kind: h.kind, startWord: h.startWord, endWord: h.endWord, rect: h.rect && h.kind !== "ink" ? JSON.parse(h.rect) : null, ink: h.rect && h.kind === "ink" ? JSON.parse(h.rect) : null, color: h.color, note: h.note, createdAt: h.createdAt.toISOString() };
}

router.get("/books/:id/highlights", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  if (!bookId) { res.status(400).json({ error: "Invalid book" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const rows = await db.select().from(bookHighlightsTable).where(and(
    eq(bookHighlightsTable.userId, req.user!.id), eq(bookHighlightsTable.bookId, bookId), eq(bookHighlightsTable.fileKey, fileKeyOf(access.book.storagePath)),
  ));
  res.set("Cache-Control", NO_STORE).json(rows.map(highlightView));
});

router.post("/books/:id/highlights", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  if (!bookId) { res.status(400).json({ error: "Invalid book" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const parsed = HighlightBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid highlight" }); return; }
  const d = parsed.data;
  const existing = await db.select({ id: bookHighlightsTable.id, kind: bookHighlightsTable.kind }).from(bookHighlightsTable).where(and(eq(bookHighlightsTable.userId, req.user!.id), eq(bookHighlightsTable.bookId, bookId)));
  const inkCount = existing.filter((e) => e.kind === "ink").length;
  if (d.kind === "ink" ? inkCount >= 20000 : existing.length - inkCount >= 5000) { res.status(400).json({ error: d.kind === "ink" ? "You've reached the pen-stroke limit for this book." : "You've reached the highlight limit for this book." }); return; }
  const [row] = await db.insert(bookHighlightsTable).values({
    userId: req.user!.id, bookId, fileKey: fileKeyOf(access.book.storagePath), page: d.page, kind: d.kind,
    startWord: d.kind === "words" ? Math.min(d.startWord, d.endWord) : null,
    endWord: d.kind === "words" ? Math.max(d.startWord, d.endWord) : null,
    rect: d.kind === "area" ? JSON.stringify(d.rect) : d.kind === "ink" ? JSON.stringify(d.ink) : null,
    color: d.color ?? "yellow", note: d.note ?? null,
  }).returning();
  res.status(201).json(highlightView(row));
});

router.patch("/books/:id/highlights/:hid", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id), hid = idOf(req.params.hid);
  if (!bookId || !hid) { res.status(400).json({ error: "Invalid request" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const parsed = z.object({ color: ColorSchema.optional(), note: z.string().max(1000).nullable().optional() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid highlight" }); return; }
  const [row] = await db.update(bookHighlightsTable).set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(bookHighlightsTable.id, hid), eq(bookHighlightsTable.userId, req.user!.id), eq(bookHighlightsTable.bookId, bookId))).returning();
  if (!row) { res.status(404).json({ error: "Highlight not found" }); return; }
  res.json(highlightView(row));
});

router.delete("/books/:id/highlights/:hid", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id), hid = idOf(req.params.hid);
  if (!bookId || !hid) { res.status(400).json({ error: "Invalid request" }); return; }
  // No book-access check on purpose: a student can always remove their own
  // highlights, even from a book they've since lost access to.
  const deleted = await db.delete(bookHighlightsTable)
    .where(and(eq(bookHighlightsTable.id, hid), eq(bookHighlightsTable.userId, req.user!.id), eq(bookHighlightsTable.bookId, bookId))).returning({ id: bookHighlightsTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Highlight not found" }); return; }
  res.json({ ok: true });
});

// ---- Reading position -----------------------------------------------------------
router.put("/books/:id/progress", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  const parsed = z.object({ page: z.number().int().min(1).max(100000) }).safeParse(req.body);
  if (!bookId || !parsed.success) { res.status(400).json({ error: "Invalid request" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  await db.insert(bookReadingProgressTable).values({ userId: req.user!.id, bookId, page: parsed.data.page })
    .onConflictDoUpdate({ target: [bookReadingProgressTable.userId, bookReadingProgressTable.bookId], set: { page: parsed.data.page, updatedAt: new Date() } });
  res.json({ ok: true });
});

// ---- Table of contents ------------------------------------------------------------
router.get("/books/:id/outline", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  if (!bookId) { res.status(400).json({ error: "Invalid book" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  try {
    const book = await loadBook(access.book.storagePath);
    res.set("Cache-Control", NO_STORE).json({ items: await getOutline(book) });
  } catch (err) { fail(res, err); }
});

// ---- Search inside the book -----------------------------------------------------------
// Returns where the words are (page + word range, the same indices highlights use) —
// never the text around them.
router.get("/books/:id/search", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 80) : "";
  if (!bookId || q.length < 2) { res.status(400).json({ error: "Type at least 2 characters to search." }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const limit = checkRateLimit(`booksearch:${req.user!.id}`, 40, 60 * 1000);
  if (!limit.allowed) { res.status(429).json({ error: "Too many searches. Wait a moment and try again." }); return; }
  try {
    const book = await loadBook(access.book.storagePath);
    res.set("Cache-Control", NO_STORE).json(await searchBook(book, q));
  } catch (err) { fail(res, err); }
});

// ---- Bookmarks ---------------------------------------------------------------------------
const bookmarkView = (b: typeof bookBookmarksTable.$inferSelect) => ({ id: b.id, page: b.page, label: b.label, createdAt: b.createdAt.toISOString() });

router.get("/books/:id/bookmarks", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  if (!bookId) { res.status(400).json({ error: "Invalid book" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const rows = await db.select().from(bookBookmarksTable).where(and(eq(bookBookmarksTable.userId, req.user!.id), eq(bookBookmarksTable.bookId, bookId)));
  res.set("Cache-Control", NO_STORE).json(rows.sort((a, b) => a.page - b.page).map(bookmarkView));
});

router.post("/books/:id/bookmarks", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id);
  const parsed = z.object({ page: z.number().int().min(1).max(100000), label: z.string().trim().max(120).nullable().optional() }).safeParse(req.body);
  if (!bookId || !parsed.success) { res.status(400).json({ error: "Invalid bookmark" }); return; }
  const access = await resolveBookAccess(req.user!, bookId);
  if (!access.ok) { res.status(access.status).json({ error: access.error }); return; }
  const existing = await db.select({ id: bookBookmarksTable.id }).from(bookBookmarksTable).where(and(eq(bookBookmarksTable.userId, req.user!.id), eq(bookBookmarksTable.bookId, bookId)));
  if (existing.length >= 1000) { res.status(400).json({ error: "You've reached the bookmark limit for this book." }); return; }
  const [row] = await db.insert(bookBookmarksTable).values({ userId: req.user!.id, bookId, page: parsed.data.page, label: parsed.data.label || null })
    .onConflictDoUpdate({ target: [bookBookmarksTable.userId, bookBookmarksTable.bookId, bookBookmarksTable.page], set: { label: parsed.data.label || null } }).returning();
  res.status(201).json(bookmarkView(row));
});

router.delete("/books/:id/bookmarks/:bid", requireAuth, async (req, res): Promise<void> => {
  const bookId = idOf(req.params.id), bid = idOf(req.params.bid);
  if (!bookId || !bid) { res.status(400).json({ error: "Invalid request" }); return; }
  // Like highlights: a student can always remove their own, even after losing access.
  const deleted = await db.delete(bookBookmarksTable)
    .where(and(eq(bookBookmarksTable.id, bid), eq(bookBookmarksTable.userId, req.user!.id), eq(bookBookmarksTable.bookId, bookId))).returning({ id: bookBookmarksTable.id });
  if (!deleted.length) { res.status(404).json({ error: "Bookmark not found" }); return; }
  res.json({ ok: true });
});

export default router;
