# Database Backup & Restore

Admin → **Database Backup & Restore** (new page, separate from the existing MCQ-bank-only
backup under Admin → MCQ bank). Exports the whole platform as portable JSON and restores from
a previous export. No architecture, auth, routes, or schema changed to build this — it's an
additive feature on top of the existing PostgreSQL/Supabase + Drizzle setup.

## Three scopes

| Scope | What it covers | Contains student PII? |
|---|---|---|
| **full** | Everything in `content` and `users` together, in one file — content tables first, then user tables, same dependency order each group already uses. The single-file migration path: one export, one import, on a fresh PostgreSQL/Supabase (or MySQL) database. | Yes (it includes `users`) |
| **content** | Colleges, programs, academic years, batches, blocks, modules, subjects, topics, MCQs, exam-question links, flashcards, resources, books, past papers, team members, membership plans, coupons, MCQ import profiles, OSPE/OSCE content, and platform settings (secrets redacted — see below) | No |
| **users** | Every student account plus their activity: documents, payments, memberships, book purchases, practice attempts/answers, progress, challenges, notebook, highlights, reading progress, saved sessions, flagged MCQs, feedback (+ replies), notifications, exam/OSPE attempts & answers, AI Visualizer logs | Yes |

`content` (26 tables) + `users` (24 tables) = 50 of the application's 55 tables — every table
except the 5 below, which are excluded from `full` too, on purpose:
- `med_user_sessions` — live device sessions tied to a JWT `sid`; meaningless to restore.
- `med_email_verification_tokens`, `med_password_reset_tokens` — single-use, short-lived.
- `med_payment_webhook_events` — raw gateway payloads; the derived `med_payments` rows are
  what's exported instead.
- `med_audit_logs` — an activity trail of the server that made it, not portable app data.

## What's redacted

- **Platform settings** whose key looks like a secret (matches `API_KEY`, `API_SECRET`,
  anything ending `_PASS`, containing `SECRET`, or the admin signup code) are exported with
  their value replaced by `"__REDACTED__"`. Reconfigure those from Admin → Platform settings
  after a restore — never carry them cross-environment via this file.
- **User password hashes** are always replaced with `"__REDACTED__"`. Every student's account,
  id, and activity survives a restore intact; they sign in again via "Forgot password" (or an
  admin resets it) afterward. This also means authentication on a future MySQL build is a
  separate concern from this backup — see "Auth note" below.

## File format

```json
{
  "formatVersion": 1,
  "application": "MedSchoolProffs",
  "scope": "content",
  "exportedAt": "2026-09-25T12:00:00.000Z",
  "source": { "database": "postgresql" },
  "counts": { "institutions": 4, "modules": 12, "mcqs": 18500, "...": "..." },
  "data": { "institutions": [ { "id": 1, "...": "..." } ], "modules": [ /* ... */ ], "...": [] }
}
```

- Every row keeps its **original numeric id** and every foreign key column — nothing is
  renumbered on export or import, so relationships (Module → Subject → Topic → MCQ, a payment
  → its user, etc.) are preserved exactly.
- Dates are plain ISO-8601 strings (whatever Postgres/Drizzle already serializes them as over
  JSON) — no Postgres-specific types or SQL anywhere in the file.
- `data` keys are in **dependency order** (a table never appears before something it points
  at) — see `CONTENT_TABLES`/`USER_TABLES` in `artifacts/api-server/src/lib/fullBackup.ts`.
  This is also the order rows are inserted on restore.

## Restore flow

1. **Upload → validate (dry run).** `POST /admin/full-backup/validate` parses the file and
   checks: valid JSON, `application`/`formatVersion` match, every expected section present,
   duplicate ids within a table, and foreign keys that don't resolve within the file (reported
   as warnings — those specific references are nulled out on restore rather than failing the
   whole import). Before checking whether the target already has data, it calls the same
   idempotent `ensureSchema()` the app runs at boot (`lib/db/src/ensureSchema.ts` — `CREATE
   TABLE`/`ALTER ... IF NOT EXISTS` for every table), so validating against a brand-new/empty
   database (e.g. right after pointing `DATABASE_URL` at a fresh Supabase project) doesn't fail
   just because the tables don't exist yet. It's a no-op against a database that already has the
   schema. It also reports whether the target database already has data for this scope.
   Nothing else is written to the database by this step.
2. **Confirmation screen** (the admin UI) shows the backup's export date, per-table record
   counts, and every validation error/warning before the admin can proceed.
3. **Restore.** `POST /admin/full-backup/import` re-validates server-side (never trusts that
   step 1 ran, or that nothing changed since — this also means schema prep runs again, itself a
   no-op the second time), then runs inside **one database transaction**:
   - `mode=restore-empty` (default): the primary migration path — restore into a database with
     no existing data for this scope. Refuses with a 409 if the target already has rows, so a
     restore never silently creates duplicates.
   - `mode=wipe-and-restore`: explicit admin override — deletes existing rows for this scope's
     tables (reverse dependency order) and restores, in the same transaction. If anything fails,
     the whole thing rolls back to exactly the pre-import state — there's no "wiped but only
     half-restored" outcome.
   - After commit, every table's Postgres sequence is resynced to `max(id)` so future inserts
     (new signups, new MCQs, etc.) don't collide with restored ids.
4. **Result.** The response (and the admin UI) show exactly how many rows were restored per
   table, and — for a wipe — how many were deleted first. Also written to `med_audit_logs` as
   a `FULL_DATABASE_RESTORED` entry.

## Endpoints (admin-only — `requireAdmin`)

PostgreSQL (this application's own database):

- `GET /admin/full-backup/export?scope=full|content|users` — downloads the JSON file.
- `POST /admin/full-backup/validate` — multipart `file`; dry-run validation, no writes.
- `POST /admin/full-backup/import?mode=restore-empty|wipe-and-restore` — multipart `file`.

MySQL (an admin-supplied database, for migration — see below):

- `POST /admin/full-backup/mysql/test-connection` — JSON body `{ url }`; connects and closes,
  never stores the connection string.
- `POST /admin/full-backup/mysql/validate` — multipart `file` + `url`; same dry-run checks as
  the Postgres validate route, plus whether the MySQL target already has rows for this scope.
- `POST /admin/full-backup/mysql/import?mode=restore-empty|wipe-and-restore` — multipart `file`
  + `url`.

All reject non-admins (same `requireAdmin` middleware as every other admin route) and reject
anything that isn't `.json`/`application/json`. Upload size cap: 200MB. The MySQL connection
string is never written to a database or log line — it's used for one request and discarded.

## PostgreSQL → MySQL data migration

This format is the bridge:

```
CURRENT (PostgreSQL/Supabase)  →  Export JSON (this feature)  →  medschoolproffs-*-backup.json
      →  Create MySQL schema  →  Restore same JSON into MySQL (admin UI or CLI, below)
      →  (separately, later) convert the running app's backend from Postgres to MySQL
```

Nothing in the file is Postgres-specific, ids/relationships are preserved exactly, dates are
plain ISO strings, and `formatVersion` is carried in the file so a future schema change can add
a `formatVersion: 2` importer that still reads v1 files (or explicitly rejects them with a
clear message, which `validateFullBackup`/`validateBackupFile` already does for any version
newer than the running server supports).

The MySQL restore is available both from the admin UI (Admin → Database Backup & Restore → pick
"MySQL database" as the restore target on either card, paste a connection string, then upload
and restore the same file you'd otherwise restore into Postgres) and from the CLI (below) for
scripting or environments without UI access. Both paths call the same
`scripts/src/mysql-restore/` logic. Neither one changes which database the live application
itself talks to — that's the separate "convert the running app's backend" step above, not yet
done.

### Auth note

Student rows, ids, and all their activity migrate via this JSON. **Login credentials do not** —
password hashes are redacted by design (see above). A MySQL build's importer needs its own plan
for authentication: either force a password reset for every account after migration, or handle
credential migration as a separate, explicit step outside this backup file. Nothing about how
authentication works today (bcrypt hash in `med_users.password_hash`, JWT session cookies) was
changed by this feature.

### The MySQL importer (`scripts/src/mysql-restore/`)

A standalone tool in `@workspace/scripts` — it does **not** import `@workspace/db` (that package
opens a real Postgres connection just by being imported), so it has no Postgres dependency at
all and running it touches nothing in the live app. It reads the same JSON this page exports and
writes to whatever MySQL database you point it at. Its core functions (`testMysqlConnection`,
`validateForMysql`, `restoreToMysql`, exported from `restore.ts`) are also imported directly by
`artifacts/api-server/src/routes/full-backup-mysql.ts`, which is what the admin UI's "MySQL
database" option calls — the CLI below and the UI run the exact same restore code, just with a
different entry point.

**1. Create the MySQL schema** (once, against a fresh MySQL database):

```bash
pnpm --filter @workspace/scripts run generate:mysql-schema -- --scope=content > content-schema.sql
pnpm --filter @workspace/scripts run generate:mysql-schema -- --scope=users > users-schema.sql
mysql -u <user> -p <database> < content-schema.sql
mysql -u <user> -p <database> < users-schema.sql
```

Omit `--scope` to emit both scopes' tables in one file. This mirrors `medschool.ts` column-for-
column (`serial→INT AUTO_INCREMENT`, `boolean→TINYINT(1)`, `timestamp→DATETIME(3)`,
`numeric→DECIMAL(14,4)`, Postgres `text[]`/`jsonb`→`JSON`). Like the Postgres schema itself, it
adds no `FOREIGN KEY` constraints or unique indexes — this app has never used database-level FKs
(relationships are validated at the JSON layer, same as `FK_CHECKS` below); add real indexes
separately if you're standing MySQL up for production traffic, not from this generator.

**2. Restore a backup file into it:**

```bash
pnpm --filter @workspace/scripts run restore:mysql -- \
  --file=/path/to/medschoolproffs-content-backup.json \
  --url=mysql://user:pass@host:3306/medschoolproffs \
  --mode=restore-empty
```

`--mode=wipe-and-restore` deletes existing rows for that scope first (reverse dependency order),
same override as the Postgres restore. Everything runs in one MySQL transaction — a failure rolls
back to the pre-restore state, and `AUTO_INCREMENT` is resynced to `MAX(id)` per table afterward
so new inserts don't collide with restored ids (same reason the Postgres importer resets
sequences). Validation (`formatVersion`, duplicate ids, dangling FK warnings) runs first and
writes nothing if it fails — same rules as `validateFullBackup`, reimplemented with no database
dependency in `scripts/src/mysql-restore/validate.ts`.

**What this doesn't do:** create the MySQL database itself, migrate the running app's code from
Drizzle's Postgres driver to its MySQL driver, or touch authentication (see "Auth note" above —
password hashes are redacted in the JSON regardless of destination database). Those remain
separate, explicit steps for whenever the actual PostgreSQL → MySQL cutover happens; this importer
only makes sure the data side of that day is a solved problem.

## Testing checklist

- [ ] Export `content`, confirm the file opens as JSON and `counts` matches the admin's own
      dashboard numbers.
- [ ] Export `users`, confirm no `password_hash` value appears in the file (only
      `"__REDACTED__"`).
- [ ] Import a `content` export into a fresh database (`mode=restore-empty`) and confirm the
      curriculum tree renders identically in the student app.
- [ ] Re-import the same file without wiping first — confirm it's refused with a 409, not
      silently duplicated.
- [ ] Import with `mode=wipe-and-restore` into a database that already has different data —
      confirm the old rows are gone and the backup's rows are present, with ids intact.
- [ ] Upload a non-JSON file — confirm a clear rejection, no partial write.
- [ ] Hand-edit a backup to delete one `modules` row a `subjects` row still points at — confirm
      validation reports it as a warning, and the restored subject's `moduleId` comes back
      `null` rather than the import failing outright.
- [ ] Confirm large exports (thousands of MCQs) complete without timing out (batched inserts,
      500 rows per statement).
- [ ] In the admin UI, switch a card's restore target to "MySQL database", paste a real MySQL
      connection string, and confirm "Test connection" succeeds.
- [ ] From the same UI, upload a backup file and confirm validation shows counts/warnings the
      same way it does for the Postgres target, then restore with `restore-empty` into an empty
      MySQL database and verify row counts match.
- [ ] Re-run the same UI restore without wiping first — confirm it's refused (409), matching the
      Postgres behavior.
- [ ] Confirm no MySQL connection string ever appears in server logs or the browser's network
      tab response body after a request completes.
