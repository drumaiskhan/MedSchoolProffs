# Hand-off note — v47 (AI option-explanation rectifier)

Changed files (drop over v46):
- artifacts/api-server/src/lib/aiExplain.ts — `rectifyOptionExplanations()` (+ prompt, `RECTIFY_MIN_OPTION_CHARS = 220`)
- artifacts/api-server/src/routes/explanations.ts — POST /admin/mcqs/rectify-option-explanations
- artifacts/frontend-admin/src/lib/api.ts — `mcqAdminApi.rectifyOptionExplanations`
- artifacts/frontend-admin/src/lib/shared-parts/bank.tsx — button "AI: rectify option explanations (long)" in the analysis panel (chart icon) on every topic / subject / module row and on a past paper

Behaviour: for every MCQ in the scope whose per-option explanations are missing, wrong count, or any option shorter than 220 chars, the AI rewrites ALL options
in the site's existing house style — each starts "This is correct; …" / "This is incorrect because …" (letter not written; the UI adds "A :") — but 2-3 full sentences (~40-70 words), verdict woven in, matching the AI MCQ Solver's explanations: reason, then mechanism / what the option really is / why it doesn't fit this stem.
Tune length in buildRectifyOptionExplanationsPrompt ("2-3 full sentences") and RECTIFY_MIN_OPTION_CHARS.
Existing text is passed as a draft (kept if correct, expanded, fixed if wrong); module/subject/topic names are given for context. The answer key is not changed.
A rewrite is saved only if the AI returns exactly one string per option and each is >=160 chars; otherwise the row keeps its old text and is counted as "skipped".
Server handles 3 questions per call (22s deadline each, under the 26s proxy ceiling); the frontend loops with a cursor (`afterId`) so failures are never retried forever.
API also accepts `{ids:[..≤3]}` (always rewrites) and `{all:true, force:true}` (also redoes already-long ones) — no UI for those yet.
Costs AI credits. Verified: syntax only (lockfile in the zip is malformed) — run `pnpm run typecheck` after relocking.
