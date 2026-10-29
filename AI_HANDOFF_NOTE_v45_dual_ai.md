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
