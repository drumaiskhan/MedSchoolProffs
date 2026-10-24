# v109 - students' Saved MCQs lost after a replace/re-import

Cause: `deleteMcqsEverywhere` (lib/mcqCascade.ts) deletes `med_saved_mcqs` rows together with the questions, and a backup restore in "replace" mode (lib/mcqBackup.ts structure restore, routes/mcq-backup.ts v1 path) re-inserts the questions with NEW ids. Every saved row for the replaced questions was lost.

Fix 1 (prevent): `lib/savedMcqMarks.ts` - `snapshotSavedMarks` (before the delete) + `restoreSavedMarks` (after the re-insert) re-attach saves by normalised question text + placement. Wired into both replace paths; the response/summary reports `savedKept`. Exam/past-paper deletes still drop saves on purpose.
Fix 2 (recover): `POST /api/admin/full-backup/restore-saved-mcqs[?dryRun=1]` (file = an older Full/Users backup with `savedMcqs` + `mcqs`), card "Restore students' Saved MCQs" on Admin -> Database Backup & Restore. Idempotent (never duplicates, never deletes).
Not run against a real database here. Without an older backup the lost saves cannot be rebuilt (Supabase point-in-time/daily backup can be restored to a scratch DB and exported as a Full backup).
