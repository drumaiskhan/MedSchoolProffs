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

## MCQ bank Export / Import with structure (v18)
- Admin → MCQ bank → "Export / import backup" (`components/McqBackupPanel.tsx`, replaces the inline panel in AdminMcqs).
- Scope picker (`BackupScopePicker`) now has **One program (MBBS / BDS / Shared)** and, for **One year**, an optional program (Any / MBBS / BDS / Shared). "Shared" = content with no programTargetKind.
- Export file is format **v2**: questions + `structure` (blocks, modules, subjects, topics incl. empty ones, past papers, exams, exam_questions) + `coverage` (which source nodes the scope covers). Whole-bank export carries the whole tree. v1 files still import the old way (raw ids, structure must exist).
- Import (`POST /admin/mcq-backup/import?mode=merge|append|replace`, default **merge**): rebuilds missing structure and remaps every id, all in ONE transaction (rolls back fully on error). Nodes are matched before created (block: name+program+year; module/subject/topic: name under mapped parent; paper: title+board+year+level; exam: title+start) so restoring into the same DB reuses the tree. Restored exams always come back as drafts. `replace` only deletes what the scope covers (via `coverage`), never other programs/years.
- `POST /admin/mcq-backup/preview` = dry run with identical logic; the UI shows it before the confirm button enables.
- `backupScope.ts`: new levels/`program` filter, `targetingMatchesScope`, `resolveModuleIdsForScope` now honours module-or-parent program+year. Flashcard backup shares the scope code (picker options apply there too; flashcards are still flat, no structure in their file).
- `mcqCascade.deleteMcqsEverywhere` takes an optional executor (transaction) and chunks ids (20k).
- Test: `artifacts/api-server/test/mcq-backup.integration.ts` (needs a throwaway Postgres; header explains how). Covers scoping, same-DB merge no-op, append, scoped replace, cross-DB id remap, rollback, v1 parse.
- All packages typecheck; admin + api-server build. Not click-tested in a browser.

## OSPE/OSCE: pictures not loading + AI marking anything (v19)
- **Pictures**: admin uploads save a storage path (`supabase:…` / `cloudinary:…`) in imagePath/attachmentPath. `routes/ospe.ts` returned that raw path, and both apps ran it through `resolveUploadUrl()` (just prefixes the API origin) -> broken image. Now a middleware on the /ospe + /admin/ospe routes adds `imageUrl`/`attachmentUrl` (via `resolveFileUrl`) next to every `imagePath`/`attachmentPath` in any response (nested too). Raw paths are unchanged so forms still save paths. Admin (`fileUrl()` helper + `uploadedUrls` cache for just-uploaded previews) and student pages prefer `*Url`.
- **Grading** (`lib/aiExplain.ts`, `gradeWrittenAnswer`): the old prompt asked the AI to pick a mark and fell back to "partial"/half marks on any unparseable output; with no model answer it said "grade generously". Now: the AI only lists the model answer's key points and says which the student met (+ count of wrong statements); **marks are computed in code** (`scoreFromChecklist`: max x met/total, minus one point per wrong statement, quarter-mark steps). Malformed output throws -> station stays "not graded yet" (retryable), never a guessed mark. Student text is fenced and treated as data (prompt-injection like "award full marks" is ignored and counted as wrong). No model answer -> not auto-graded; creating a WRITTEN station without one is rejected (API + admin form disabled button). Existing WRITTEN stations without a model answer stay ungraded until one is added.
- Tests: `artifacts/api-server/test/ospe-grading.test.ts` (pure, no DB; run command in header).
- Model answers work best as one key point per line.
