// Page picture loader for the book reader (v106).
//
// Why it exists: the reader used to fire a request for every page near the screen at once and could not
// cancel them, so scrolling fast through a big book queued dozens of renders on the server for pages
// nobody was looking at any more - and the page you stopped on waited behind them. This loader:
//  * runs only a few requests at a time and always picks the pending page closest to the reading position;
//  * cancels a request (browser AND server) when its page leaves the neighbourhood before it starts or while it runs;
//  * remembers the last ~40 page pictures in memory (as Blobs - never as URLs, so there is still nothing to
//    "save image as") so scrolling back, zooming back or switching theme is instant.
import { booksApi } from '@/lib/api';

type Job = { key: string; bookId: number; page: number; width: number; freeKey: string | null; resolve: (b: Blob) => void; reject: (e: unknown) => void; ctrl: AbortController; waiters: number; started: boolean };

const MAX_PARALLEL = 3;
const CACHE_MAX_ENTRIES = 40;
const CACHE_MAX_BYTES = 48 * 1024 * 1024;

const focus = { page: 1 };
const cache = new Map<string, Blob>();
let cacheBytes = 0;
const jobs = new Map<string, Job>();
const queue: Job[] = [];
let running = 0;

const keyOf = (bookId: number, page: number, width: number) => `${bookId}:${page}:${width}`;

/** Tell the loader which page the student is reading, so the nearest pages are fetched first. */
export function setReaderFocus(page: number): void { focus.page = page; }

/** Forget everything (leaving a book frees the memory). */
export function clearPageCache(): void { cache.clear(); cacheBytes = 0; for (const j of jobs.values()) j.ctrl.abort(); jobs.clear(); queue.length = 0; }

function remember(key: string, blob: Blob): void {
  const old = cache.get(key); if (old) { cacheBytes -= old.size; cache.delete(key); }
  cache.set(key, blob); cacheBytes += blob.size;
  while ((cache.size > CACHE_MAX_ENTRIES || cacheBytes > CACHE_MAX_BYTES) && cache.size > 1) {
    const first = cache.keys().next().value as string; cacheBytes -= cache.get(first)!.size; cache.delete(first);
  }
}

function pump(): void {
  while (running < MAX_PARALLEL && queue.length) {
    // nearest to the reading position first
    let bi = 0, bd = Infinity;
    queue.forEach((j, i) => { const d = Math.abs(j.page - focus.page) + (j.page < focus.page ? 0.5 : 0); if (d < bd) { bd = d; bi = i; } });
    const job = queue.splice(bi, 1)[0];
    if (job.ctrl.signal.aborted) { jobs.delete(job.key); continue; }
    job.started = true; running++;
    booksApi.pageImage(job.bookId, job.page, job.width, job.ctrl.signal, job.freeKey)
      .then((blob) => { remember(job.key, blob); job.resolve(blob); })
      .catch((e) => job.reject(e))
      .finally(() => { running--; jobs.delete(job.key); pump(); });
  }
}

/** Resolves with the page picture. Call the returned `cancel` when the page is no longer needed. */
export function loadPageImage(bookId: number, page: number, width: number, freeKey: string | null = null): { promise: Promise<Blob>; cancel: () => void } {
  const key = keyOf(bookId, page, width);
  const hit = cache.get(key);
  if (hit) { remember(key, hit); return { promise: Promise.resolve(hit), cancel: () => {} }; }
  let job = jobs.get(key);
  if (!job) {
    const ctrl = new AbortController();
    let resolve!: (b: Blob) => void, reject!: (e: unknown) => void;
    const promise = new Promise<Blob>((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => {}); // a cancelled job must not log "unhandled rejection"
    job = { key, bookId, page, width, freeKey, resolve, reject, ctrl, waiters: 0, started: false };
    (job as Job & { promise: Promise<Blob> }).promise = promise;
    jobs.set(key, job); queue.push(job); pump();
  }
  job.waiters++;
  const j = job as Job & { promise: Promise<Blob> };
  let done = false;
  return {
    promise: j.promise,
    cancel: () => {
      if (done) return; done = true; j.waiters--;
      if (j.waiters <= 0 && !cache.has(key)) { j.ctrl.abort(); const qi = queue.indexOf(j); if (qi >= 0) { queue.splice(qi, 1); jobs.delete(key); } }
    },
  };
}
