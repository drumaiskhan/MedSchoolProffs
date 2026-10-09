# Hand-off note — v44 (nodemailer 6 -> 10)

- `artifacts/api-server/package.json`: `nodemailer` ^6.9.15 -> ^10.0.15; removed `@types/nodemailer` (v10 ships its own types).
- No code changes: `lib/email.ts` `sendViaSmtp` uses plain `createTransport` + `sendMail` (dynamic import still valid; `nodemailer` stays external in build.mjs).
- v10 requires Node >= 20 (Dockerfile / CI / Netlify already use 22).
- Breaking changes reviewed: v8 error code `NoAuth` -> `ENOAUTH` (not referenced here); v9 validates TLS certs when fetching remote attachments/OAuth2 (not used here; SMTP unaffected).
- **pnpm-lock.yaml NOT regenerated** (no network in the sandbox). Run `pnpm install` before any `--frozen-lockfile` build.
- Not run: install, build, typecheck, sending a real email (use Admin -> Settings -> Send test email after deploying).
- Further load-time ideas (not done): slim/paginated `GET /admin/mcqs` (~7 MB; McqTreeRow needs full rows for editing so rows must load lazily), split student `index.css` (270 kB, render-blocking).

## v44b addendum — safe hardening pass (deployed app, nothing here changes behaviour)
- `multer` ^1.4.5-lts.1 -> ^2.0.2 (fixes CVE-2025-47935 / CVE-2025-47944, both DoS). All uses are `multer.memoryStorage()` + `MulterError`, API unchanged. Test one upload per route after deploy (cover image, book PDF, favicon, backup restore, past-paper backup).
- `lib/email.ts` SMTP: connection/greeting/socket timeouts and `transport.close()` after send. (Pooling not enabled — a pool would need a shared long-lived transport; the per-send close is the safe variant.)
- `lib/db/src/ensureSchema.ts`: `CREATE INDEX IF NOT EXISTS idx_med_mcqs_past_paper_id` (after COMMIT).
- `.github/workflows/ci.yml`: typecheck + build on PRs / non-main pushes. Does not deploy.
- Repo tidy: handoff notes moved to `docs/handoff/` (CHANGES.md links + .dockerignore updated), stray `how --stat f9e077b` file removed, stale `*.tsbuildinfo` deleted and git-ignored.
- Deliberately NOT changed (need testing against real data/uploads): `xlsx`, `pdf-parse`, `bcryptjs`, `dotenv`, splitting `medschool.ts` / `bank.tsx` / admin `api.ts`, slim MCQ endpoint, student CSS split.
- Lockfile still not regenerated. hostinger-build.yml / build-hostinger.sh use `--no-frozen-lockfile`, so that deploy is fine; check Dockerfile if you use it with a frozen lockfile.
