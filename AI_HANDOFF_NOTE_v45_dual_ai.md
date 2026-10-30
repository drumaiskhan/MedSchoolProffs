# Hand-off note — v45 (two AI providers sort past-paper topics together + login trigger)

Changed files (drop over v44):
- artifacts/api-server/src/lib/aiExplain.ts   — new `runPromptOnTwo()` (two providers in parallel; prefers two different companies)
- artifacts/api-server/src/lib/paperTopics.ts — `classifyBatchWithTwo()` (agree / one-answered / tie-break) + `kickPastPaperSortingOnLogin()`
- artifacts/api-server/src/routes/auth.ts     — calls `kickPastPaperSortingOnLogin()` after a successful login
- install.sh / install.bat — lock-file installer (pnpm install --frozen-lockfile; `--relock` / `relock` refreshes pnpm-lock.yaml)

Rules: both agree -> label; only one answered -> that label; disagree -> tie-break asking both with just the 2 disputed subjects;
still no agreement -> "General". One provider configured -> behaves like v44. Both fail -> normal failover.
Login sweep: one grouped COUNT, max once per 10 min per server, max 10 papers, background only, never delays login.
Needs 2 providers in Admin -> Platform settings -> AI (slots 1-6 or env keys). Syntax-checked only; run `pnpm -r typecheck`.
- artifacts/frontend-student/src/pages/PastPaperDetail.tsx — REWRITTEN: one page = paper hero (total/easy/medium/hard) + multi-select topic cards + difficulty + count (10/20/50/All/custom) + Timer/Timeless with minutes + shuffle + sticky live "Your test" summary & Start. Two-column on wide screens (config left, sticky summary right), single column on phones.
- artifacts/frontend-student/src/pages/Practice.tsx — new effect: `/practice?pastPaperId=N&go=1&timer=timed|untimed&min=M&n=N|all&diff=easy|moderate|hard&shuffle=1&subject=key...` starts the session immediately (old setup screen is still the fallback for every other entry point and for "restart").
- Old typecheck errors on `ink` came from stale *.tsbuildinfo in the zip; they are removed. Run: delete any *.tsbuildinfo, then `pnpm run typecheck`.
- PastPaperDetail.tsx mobile pass: compact hero, difficulty + question-count each in ONE row of 4, 2-col topic cards ("All topics" full width), Timer/Timeless side by side, shorter stepper/presets, hidden helper text on phones, and a slim sticky "N of total · Start" bar (bottom-[5.5rem], above the bottom nav) replacing the summary card; the full summary card is lg+ only.

## Block-scoped sorting + automatic re-check (added after the first v45 cut)
- A paper now sorts ONLY into its own Block's subjects (Block B paper never gets Block C's Physiology). Block = `med_past_papers.block_id` if set (PATCH /past-papers/:id {blockId}), else a block name found in the paper title as whole words ("Block G PreProff" -> Block G), else the block most of its admin-tagged questions sit in, else old behaviour (degree/year scope). Each subject is shown to the AI with its module name.
- `med_mcqs.paper_subject_ver` + `CLASSIFY_VERSION = 2` (lib/paperTopics.ts): every label from older logic counts as "pending" and is re-checked by the two AIs automatically (first open of a paper, login sweep, admin "Sort all"). Bump the constant to force another re-check. Changing a paper's title/blockId re-checks that paper.
- New columns are added by ensureSchema (and lib/db/ensure-schema.sql) on API start — no manual migration.
- Admin-tagged questions (subject_id) are still never touched. Costs AI credits for the one-time re-check of every paper.

## Per-paper classifier (admin)
- Admin -> Past papers -> each paper row has a new "AI topics" button. Its panel shows: the Block the paper is sorted within and why (set / found in title / from tagged questions) with a select to override it (Auto-detect or any block — saving re-checks that paper), the exact subjects the AI may choose from, current label counts (+ "Not sorted yet", "Tagged by you"), and buttons "Sort N waiting" and "Re-sort this paper" (loops 45-question chunks; admin-tagged questions are kept).
- New API: GET /admin/past-papers/:id/topic-info (block + source, candidate subjects, label counts, pending). Existing: POST /admin/past-papers/:id/classify {redo}, PATCH /past-papers/:id {blockId}.
- Files: api-server routes/past-papers.ts + lib/paperTopics.ts, frontend-admin pages/AdminPastPapers.tsx + lib/api.ts.
