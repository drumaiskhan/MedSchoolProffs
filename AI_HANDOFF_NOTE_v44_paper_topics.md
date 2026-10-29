# Hand-off note — v44 (past-paper Topics dropdown + AI topic sorting)

## What changed
- **Student past paper page** (`PastPaperDetail.tsx`): the multi-select chips are replaced by a **Topics dropdown** like the Pre-Proffs one —
  "Comprehensive Assessment (All Topics)" (default) or ONE topic, each with its question count, radio on the right.
  Start button attempts the whole paper or just that topic (still `/practice?pastPaperId=..&subject=<key>`, Practice.tsx unchanged).
  While the AI is sorting, a "AI is sorting..." line shows and the page re-checks every 4s.
- **AI sorting** (`api-server/src/lib/paperTopics.ts`): uses the existing `runPrompt` (Admin -> Platform settings -> AI, with failover).
  Candidate topics = distinct active subject names (scoped to the paper's degree/year when modules are targeted). 15 questions per AI call.
  Result goes in the NEW column `med_mcqs.paper_subject`. Unplaceable questions get "General".
  Questions an admin already tagged with a subject (`subject_id`) are respected and never overwritten.
- **Automatic for new papers**: after `POST /admin/mcq-import/commit` (pastPaperId set) and `POST /past-papers/:id/mcqs` (attach) the paper is sorted in the background.
- **Automatic for existing papers**: `GET /past-papers/:id/subjects` starts a background sort when it finds unsorted questions (one run per paper at a time).
  Response now also has `pending` and `classifying`.
- **Admin** (`AdminPastPapers.tsx`): new "AI topic sorting" panel — shows how many questions wait, "Sort all with AI", "Re-sort all".
  Endpoints: `GET /admin/past-papers/topic-sorting`, `POST /admin/past-papers/:id/classify {redo?}` (one ~45-question chunk per call; the screen loops).

## Why a new column and not subject_id
`GET /mcqs?subjectId=` has no pastPaperId exclusion, so tagging paper questions with subject_id would leak them into normal subject practice and Progress. `paper_subject` avoids that.

## Schema
`ALTER TABLE med_mcqs ADD COLUMN IF NOT EXISTS paper_subject TEXT;` — added to `lib/db/src/ensureSchema.ts` (runs on boot) and `ensure-schema.sql`, and to the drizzle schema.

## Known limits / not verified
- Only syntax-checked (no node_modules/network here). Run `pnpm -r typecheck` and a build before deploying; not click-tested.
- MCQ/Past-paper backup restores don't carry `paper_subject`; restored papers simply re-sort themselves on first open (or via the admin button).
- If no AI provider is configured, sorting silently does nothing for students (they see All Topics only); the admin button shows the real error.
