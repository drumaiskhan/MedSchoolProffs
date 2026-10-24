import { Router, type IRouter } from "express";
import express from "express";
import multer from "multer";
import { requireAuth, requireAdmin } from "../middlewares/auth";
import { uploadFile, resolveFileUrl } from "../lib/storage";
import { checkRateLimit } from "../lib/rateLimit";
import { CPANEL_PREFIX, CpanelError, cpanelAppend, cpanelConfigured, cpanelFinish } from "../lib/cpanelFiles";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB — payment proofs/profile pictures
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only PNG, JPEG, WEBP, or PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Books and resources now route to Cloudinary (see lib/storage.ts), which
// comfortably handles larger files than the 30MB cap above — raised here so
// a genuinely large textbook PDF isn't rejected at the multer layer before
// it even reaches uploadFile()'s own size-based routing check.
const uploadLarge = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only PNG, JPEG, WEBP, or PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

// Textbook / notes PDFs for the Books library are routinely well over 50MB (scanned
// notes especially). 300MB matches MAX_BOOK_BYTES in lib/bookReader.ts — anything bigger
// couldn't be opened in the reader anyway.
const uploadBook = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only PNG, JPEG, WEBP, or PDF files are allowed"));
      return;
    }
    cb(null, true);
  },
});

const uploadFavicon = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1 * 1024 * 1024 }, // 1MB — favicons are small
  fileFilter: (_req, file, cb) => {
    const allowed = ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      cb(new Error("Only PNG, ICO, SVG, or WEBP files are allowed for the favicon"));
      return;
    }
    cb(null, true);
  },
});

router.post("/uploads/payment-proof", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "payment-proofs");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), mimeType: req.file.mimetype });
});

// Unauthenticated variant for Register() — a student filling out the signup
// form has no account (and therefore no session cookie) yet, so the
// authenticated route above 401s for them. Same validation/size limit as
// the authenticated route, but rate-limited by IP since this is now an
// open-to-the-internet upload endpoint.
router.post("/uploads/payment-proof-signup", upload.single("file"), async (req, res): Promise<void> => {
  const ip = req.ip || "unknown";
  const limit = checkRateLimit(`payment-proof-signup:${ip}`, 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    res.status(429).json({ error: "Too many uploads from this connection. Please try again in a few minutes." });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "payment-proofs");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), mimeType: req.file.mimetype });
});

// Base64/JSON fallback for the mobile app. Some Android WebViews fail to send
// multipart/form-data file bodies ("Failed to fetch") even though plain JSON
// requests work, so the client retries here with the file as base64 text.
// Same validation as the multipart routes; the signup variant stays
// unauthenticated + IP rate-limited, the others require a session.
const JSON_UPLOAD_KINDS: Record<string, { folder: string; auth: boolean }> = {
  "payment-proof-signup": { folder: "payment-proofs", auth: false },
  "payment-proof": { folder: "payment-proofs", auth: true },
  "profile-picture": { folder: "profile-pictures", auth: true },
};
const JSON_UPLOAD_MIME = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
const JSON_UPLOAD_MAX_BYTES = 18 * 1024 * 1024; // base64 inflates ~33%; stays under the 25mb JSON body limit

router.post("/uploads/json/:kind", async (req, res, next): Promise<void> => {
  const cfg = JSON_UPLOAD_KINDS[String(req.params.kind)];
  if (!cfg) { res.status(404).json({ error: "Unknown upload type" }); return; }
  const run = async (): Promise<void> => {
    if (!cfg.auth) {
      const limit = checkRateLimit(`${req.params.kind}:${req.ip || "unknown"}`, 10, 15 * 60 * 1000);
      if (!limit.allowed) { res.status(429).json({ error: "Too many uploads from this connection. Please try again in a few minutes." }); return; }
    }
    const { fileName, mimeType, data } = (req.body ?? {}) as { fileName?: unknown; mimeType?: unknown; data?: unknown };
    if (typeof data !== "string" || !data) { res.status(400).json({ error: "No file uploaded" }); return; }
    if (typeof mimeType !== "string" || !JSON_UPLOAD_MIME.includes(mimeType)) { res.status(400).json({ error: "Only PNG, JPEG, WEBP, or PDF files are allowed" }); return; }
    const buffer = Buffer.from(data.replace(/^data:[^,]*,/, ""), "base64");
    if (buffer.length === 0) { res.status(400).json({ error: "No file uploaded" }); return; }
    if (buffer.length > JSON_UPLOAD_MAX_BYTES) { res.status(400).json({ error: "File is too large." }); return; }
    const name = typeof fileName === "string" && fileName ? fileName.slice(0, 120) : "upload";
    const storagePath = await uploadFile(buffer, name, mimeType, cfg.folder);
    res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), mimeType });
  };
  try {
    if (cfg.auth) {
      requireAuth(req, res, () => { run().catch(next); });
    } else {
      await run();
    }
  } catch (err) { next(err); }
});

router.post("/uploads/profile-picture", requireAuth, upload.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "profile-pictures");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath) });
});

router.post("/uploads/resource", requireAuth, uploadLarge.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "resources");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), sizeBytes: req.file.size });
});

// Books library — admin-only PDF (and optional cover image) uploads.
router.post("/uploads/book", requireAdmin, uploadBook.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "books");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), sizeBytes: req.file.size });
});

// Big book PDFs (200 MB+) go to the cPanel disk. The admin page cuts the file into 8 MB pieces and sends them one
// after another (so nothing is held in memory and no proxy times out); the last piece finishes the file.
//   POST /uploads/book-chunk?id=<random>&offset=<bytes so far>[&last=1]   body = raw bytes
router.post("/uploads/book-chunk", requireAdmin, express.raw({ type: () => true, limit: "16mb" }), async (req, res): Promise<void> => {
  const id = String(req.query.id ?? ""), offset = Number(req.query.offset), last = req.query.last === "1";
  const body = req.body as Buffer;
  if (!/^[A-Za-z0-9]{16,40}$/.test(id) || !Number.isInteger(offset) || offset < 0 || !Buffer.isBuffer(body) || body.length === 0) { res.status(400).json({ error: "Bad upload piece" }); return; }
  if (!cpanelConfigured()) { res.status(503).json({ error: "cPanel file storage is not set up yet. Add FILE_BRIDGE_SECRET (and install /cpanel-filebridge), or paste a Google Drive link instead." }); return; }
  if (offset === 0 && !body.subarray(0, 1024).toString("latin1").includes("%PDF-")) { res.status(400).json({ error: "That file is not a PDF." }); return; }
  const name = `books/${id}.pdf`;
  try {
    const size = await cpanelAppend(name, offset, body);
    if (!last) { res.json({ ok: true, size }); return; }
    const total = await cpanelFinish(name);
    res.status(201).json({ storagePath: `${CPANEL_PREFIX}${name}`, url: null, sizeBytes: total });
  } catch (err) {
    if (err instanceof CpanelError) { res.status(err.status === 413 ? 413 : 502).json({ error: err.message }); return; }
    throw err;
  }
});

// Website favicon — shown in browser tabs, so unlike the uploads above it
// must be readable by anyone (no auth cookie is sent for a plain
// <link rel="icon"> request, especially cross-origin on split deployments).
// Uploading a new one stays admin-only.
router.post("/uploads/favicon", requireAdmin, uploadFavicon.single("file"), async (req, res): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }
  const storagePath = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, "favicon");
  res.status(201).json({ storagePath, url: resolveFileUrl(storagePath), mimeType: req.file.mimetype });
});

// Local-disk file serving (/api/uploads/:folder/:filename) has been removed
// — uploadFile() no longer writes to local disk at all (see lib/storage.ts),
// so there's nothing left for this route to serve. Every storagePath now
// resolves directly to a Supabase or Cloudinary URL via resolveFileUrl().

export default router;
