# Hand-off note — v43 (v19 + fixes merged in from MedSchoolProffs-fixed.zip)

Base = v19 (admin/student code splitting, v18 structure-aware MCQ backup, OSPE grading fix, duplicate-fix repair).
Everything below was ported in from `MedSchoolProffs-fixed.zip`; every other difference between the two zips was
an older copy of code that v19 had already rewritten, so v19's version was kept.

## Ported
- **Past papers backup & restore** (own section, separate from the MCQ bank):
  `api-server/src/lib/pastPaperBackup.ts`, `routes/past-paper-backup.ts` (registered in `routes/index.ts`),
  `GET /admin/past-paper-backup/export[?paperId=]`, `POST /admin/past-paper-backup/import?mode=append|replace`
  (one transaction; also accepts a Full / Platform-content database backup). UI: `PastPaperBackupPanel` in
  `frontend-admin/src/pages/AdminPastPapers.tsx`; client: `pastPaperBackupApi` in `frontend-admin/src/lib/api.ts`.
- **Repair past paper links**: `relinkPastPapersFromBackup` in `lib/fullBackup.ts`,
  `POST /admin/full-backup/relink-past-papers`, card in `AdminDatabaseBackup.tsx`
  (fills only EMPTY `past_paper_id`, only when id + question text match).
- **Full-backup restore reports cleared links**: `RestoreResult.nulledRefs` ("table.column" -> count) and a warning
  banner in `AdminDatabaseBackup.tsx`.
- `fullBackup.ts` now exports `ensureSchemaIfMissing`; `mcqBackup.ts` now exports `BackupMcqSchema` (both needed by pastPaperBackup).
- Corrected the Full-backup note in `AdminDatabaseBackup.tsx`: the Full scope keeps secrets as stored; only the
  Platform-content scope redacts them (the v19 text said the opposite and did not match the code).

## Deliberately NOT ported (conflicts with v19's v18 design)
The fixed zip made the MCQ bank backup EXCLUDE past-paper questions (`isNull(pastPaperId)` in `mcqBackup.ts`, `skippedPastPaper`
in `routes/mcq-backup.ts`, no paper target in the AdminMcqs import form). v19's MCQ backup intentionally INCLUDES past papers
and exams in its `structure`/`coverage` and rebuilds them on restore, so that was left as is. Result: past papers can now be
backed up either way (MCQ bank backup v2, or the dedicated Past papers backup). If you want the strict split, that is a
separate change to `mcqBackup.ts` / `mcq-backup.ts` / `McqBackupPanel.tsx`.

## Not verified
Only syntax-checked (no node_modules / network in the merge environment). Run `pnpm -r typecheck` and a `vite build` before deploying.
Not click-tested in a browser.
