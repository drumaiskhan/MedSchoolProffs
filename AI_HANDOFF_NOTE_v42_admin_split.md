# Hand-off note — v42 (admin code splitting + duplicate-fix repair)

## Duplicate fix (Content Quality Center)
- `findDuplicates` cap (150) hid progress: the loop now uses the uncapped list; UI shows "Showing 150 of N".
- Loop attempts each row once per run, batches of 10, patches rows locally from the server response (no 7 MB refetch per round), stops after 3 dead rounds.
- `POST /admin/mcqs/dedupe-batch` now returns new content + `reason` per failure + `stillSimilar`.

## Admin bundle splitting (frontend-admin)
- Entry JS 1,120 kB (318 kB gz) -> 105 kB (+ vendor 256, radix 67, icons 27). recharts (`charts`) and framer-motion (`motion`) no longer load until a page needs them.
- `Student360Panel` is lazy inside `StudentDrawer` (it dragged recharts + framer-motion into the entry).
- `src/lib/shared.tsx` is now a barrel over `src/lib/shared-parts/{ui,shell,misc,auth,groups,students,payments,structure,bank}.tsx` (generated split of the old 300 kB file; dependency graph has no cycles). Import from `@/lib/shared` as before.
- `src/lib/routes.ts`: single list of page loaders (App uses `lazy(pageLoaders.X)`), idle prefetch of common pages, and hover/focus/touch prefetch for any link. Skipped on Save-Data / 2G.
- `vite.config.ts`: function-form manualChunks (vendor incl. clsx/tailwind-merge/cva, charts, motion, radix, icons). clsx MUST stay in vendor or the entry preloads `charts`.
- Verified: `vite build` succeeds, no missing-name TS errors. NOT run in a browser.
- Biggest remaining delay on /admin/quality is DATA: `GET /admin/mcqs` returns ~7 MB (27k rows). Next step would be a slim `/admin/mcqs/quality` endpoint.

## Student app (frontend-student) — same treatment
- First-load JS ~1,017 kB -> ~547 kB (entry 188 -> 121 kB). `charts` (recharts, 431 kB) and `motion` (framer-motion, 129 kB) no longer preload; they load only with pages that use them.
- `vite.config.ts` manualChunks: same rules as admin. clsx / tailwind-merge / class-variance-authority MUST stay in `vendor` and `commonjsHelpers` is pinned to `vendor`, otherwise the entry statically imports `charts`.
- Removed three unused visualizer imports from `App.tsx` and `lib/shared.tsx`.
- `lib/shared.tsx` (105 kB) is now a barrel over `lib/shared-parts/{ui,trial,practice,shell,home,payments,marketing,auth,content}.tsx` (no import cycles). Import from `@/lib/shared` as before.
- `App.tsx` `usePrefetchRoutes`: added idle warm-up of the most-used pages (skipped on Save-Data/2G); the existing hover/focus/touch prefetch is unchanged.
- Verified: `vite build` OK, no missing-name TS errors. NOT run in a browser. Remaining weight: `index.css` is 270 kB (render-blocking).

## Full typecheck (v17)
- All packages pass `tsc --noEmit`: frontend-admin, frontend-student, api-server, mockup-sandbox, scripts, and `tsc --build` for lib/*.
- api-server had 3 pre-existing errors (not from this work): added `src/workspace-scripts.d.ts` (type shim for `@workspace/scripts/mysql-restore/restore`, which esbuild bundles but api-server doesn't list as a dependency — adding it would change pnpm-lock.yaml and break `--frozen-lockfile`) and for `pdf-parse/lib/pdf-parse.js`. Keep the shim in step with scripts/src/mysql-restore/restore.ts.
- Removed stale `*.tsbuildinfo` caches from the zip: they made `tsc --build` report success without emitting `lib/*/dist`, which then broke every artifact's typecheck with TS6305 until run with `--force`.
