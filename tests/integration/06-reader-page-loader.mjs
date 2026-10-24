// v106: the book reader's page loader (priority by reading position, cancellation, in-memory cache).
// Run: node tests/integration/06-reader-page-loader.mjs
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const tmp = mkdtempSync(join(tmpdir(), "pageloader-"));
const src = join(dirname(fileURLToPath(import.meta.url)), "../../artifacts/frontend-student/src/lib/page-loader.ts");
writeFileSync(join(tmp, "page-loader.ts"), readFileSync(src, "utf8").replace("'@/lib/api'", "'./apistub.ts'"));
writeFileSync(join(tmp, "apistub.ts"), `export const log: string[] = [];
export const booksApi = { pageImage: (id: number, page: number, w: number, signal?: AbortSignal) => new Promise<Blob>((res, rej) => { log.push(\`start \${page}\`); const t = setTimeout(() => res(new Blob([\`p\${page}\`])), 30); signal?.addEventListener('abort', () => { clearTimeout(t); log.push(\`abort \${page}\`); rej(new Error('aborted')); }); }) };
`);
writeFileSync(join(tmp, "t.ts"), `import { loadPageImage, setReaderFocus, clearPageCache } from './page-loader.ts';
import { log } from './apistub.ts';
const ok = (c: boolean, m: string) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } };
setReaderFocus(50);
const jobs = [48, 49, 50, 51, 52, 10, 90].map((p) => ({ p, j: loadPageImage(1, p, 1000) }));
ok(log.join() === 'start 48,start 49,start 50', 'first three started in order of arrival: ' + log.join());
jobs.find((x) => x.p === 90)!.j.cancel(); jobs.find((x) => x.p === 10)!.j.cancel();
await new Promise((r) => setTimeout(r, 200));
ok(!log.includes('start 10') && !log.includes('start 90'), 'cancelled queued pages never start');
ok(log.includes('start 51') && log.includes('start 52'), 'remaining pages loaded');
const again = loadPageImage(1, 50, 1000); ok((await again.promise).size > 0, 'cache hit');
ok(log.filter((l) => l === 'start 50').length === 1, 'cache hit does not refetch');
const slow = loadPageImage(1, 7, 1000); await new Promise((r) => setTimeout(r, 5)); slow.cancel();
await new Promise((r) => setTimeout(r, 60)); ok(log.includes('abort 7'), 'running request aborted when its page is dropped');
clearPageCache(); console.log(process.exitCode ? 'loader test FAILED' : 'loader test passed');
`);
await import(pathToFileURL(join(tmp, "t.ts")).href);
