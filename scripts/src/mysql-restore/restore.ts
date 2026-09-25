// The future MySQL importer referenced throughout BACKUP_RESTORE.md: takes
// the exact same JSON that Admin -> Database Backup & Restore exports from
// Postgres today (GET /admin/full-backup/export?scope=content|users) and
// loads it into a MySQL database whose tables were created by
// generateSchema.ts. This file never touches Postgres or `@workspace/db` —
// it only reads a JSON file from disk and writes to whatever --url points
// at, so it's safe to run against a MySQL instance while the live app keeps
// running unmodified against Postgres/Supabase.
//
// Usage:
//   pnpm --filter @workspace/scripts run restore:mysql -- \
//     --file=/path/to/medschoolproffs-content-backup.json \
//     --url=mysql://user:pass@host:3306/medschoolproffs \
//     --mode=restore-empty        # or wipe-and-restore
//
// Mirrors restoreFullBackup() in artifacts/api-server/src/lib/fullBackup.ts
// as closely as MySQL allows:
//   - validate first (validate.ts), never write on a validation error
//   - restore-empty (default): refuses if the target already has rows for
//     this scope, same as the Postgres importer's 409
//   - wipe-and-restore: deletes existing rows (reverse dependency order),
//     then restores — all inside one transaction, rolled back on any error
//   - dangling foreign keys (a row pointing at an id not present in this
//     file) are nulled out rather than failing the row, matching the
//     validator's warning
//   - AUTO_INCREMENT is resynced to MAX(id) after each table restores,
//     same reason the Postgres importer resets the Postgres sequence:
//     otherwise the next ordinary insert (a new signup, a new MCQ) collides
//     with a restored id.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { specsFor, FK_CHECKS, NO_AUTO_INCREMENT, type MysqlTableSpec, type BackupScopeName } from "./tableMeta.js";
import { convertRow } from "./convert.js";
import { validateBackupFile, type ValidationResult } from "./validate.js";
import { ensureMysqlSchema } from "./schemaPrep.js";

// True only when this file is the process's actual entry point (run via
// `tsx restore.ts` / `pnpm run restore:mysql`), false when it's imported as
// a module — which is what full-backup-mysql.ts's API route does via
// `@workspace/scripts/mysql-restore/restore`. Without this guard, that
// import would also run the CLI's main() (and its parseArgs(), which throws
// on missing --file/--url) as a side effect, crashing the API server the
// moment the route file loads.
function isEntryPoint(): boolean {
  try {
    return !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
  } catch {
    return false;
  }
}

const INSERT_BATCH_SIZE = 500;

interface Args {
  file: string;
  url: string;
  mode: "restore-empty" | "wipe-and-restore";
}

function parseArgs(): Args {
  const get = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const file = get("file");
  const url = get("url") ?? process.env.MYSQL_URL;
  const modeArg = get("mode") ?? "restore-empty";
  if (!file) throw new Error("Missing --file=<path to backup JSON>");
  if (!url) throw new Error("Missing --url=<mysql connection string> (or set MYSQL_URL)");
  if (modeArg !== "restore-empty" && modeArg !== "wipe-and-restore") throw new Error('--mode must be "restore-empty" or "wipe-and-restore"');
  return { file, url, mode: modeArg as "restore-empty" | "wipe-and-restore" };
}

// ---------------------------------------------------------------------------
// Reusable core, callable from the CLI (below) or from the API server's
// full-backup-mysql route. Never reads from disk and never calls
// process.exit — errors are thrown so a caller (CLI or HTTP handler) can
// decide how to report them.
// ---------------------------------------------------------------------------

export interface MysqlRestoreOutcome {
  scope: BackupScopeName;
  mode: "restore-empty" | "wipe-and-restore";
  restored: Record<string, number>;
  wipedFirst: Record<string, number>;
}

export class MysqlTargetHasDataError extends Error {
  constructor(public readonly anchorTable: string) {
    super(`Target MySQL database already has data (checked \`${anchorTable}\`). Refusing to restore-empty.`);
  }
}

/** Opens a connection just to confirm the URL works, then closes it. Never leaves a lingering connection. */
export async function testMysqlConnection(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
  let conn: Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false, connectTimeout: 10_000 });
    await conn.query("SELECT 1");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await conn?.end().catch(() => {});
  }
}

/** Same JSON-only checks as the CLI's validate step, plus (if a url is given) whether the MySQL target already has rows for this scope. */
export async function validateForMysql(raw: unknown, url?: string): Promise<ValidationResult & { targetHasExistingData: boolean }> {
  const result = validateBackupFile(raw);
  if (!result.valid || !result.scope || !url) return { ...result, targetHasExistingData: false };

  const specs = specsFor(result.scope);
  const anchor = specs[0];
  let conn: Connection | undefined;
  try {
    conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false, connectTimeout: 10_000 });
    // Against a brand-new/empty database the anchor table doesn't exist yet
    // — create whatever's missing (never destructive) before checking it.
    await ensureMysqlSchema(conn, result.scope);
    const [rows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${anchor.sqlName}\``);
    return { ...result, targetHasExistingData: (rows[0]?.count as number) > 0 };
  } catch (err) {
    // Table doesn't exist yet, connection failed, etc. — surface as a validation error rather than throwing, so the caller can still show the JSON-level checks.
    return {
      ...result,
      valid: false,
      targetHasExistingData: false,
      issues: [...result.issues, { level: "error", message: `Could not check the MySQL target: ${err instanceof Error ? err.message : String(err)}` }],
    };
  } finally {
    await conn?.end().catch(() => {});
  }
}

/**
 * Restores an already-validated backup file into MySQL. Mirrors
 * restoreFullBackup() in artifacts/api-server/src/lib/fullBackup.ts as
 * closely as MySQL allows (see file header). Callers (CLI or API route)
 * must call validateForMysql()/validateBackupFile() first and refuse to
 * call this on an invalid file.
 */
export async function restoreToMysql(raw: unknown, url: string, mode: "restore-empty" | "wipe-and-restore"): Promise<MysqlRestoreOutcome> {
  const result = validateBackupFile(raw);
  if (!result.valid || !result.scope) throw new Error("This backup failed validation and cannot be restored.");

  const scope = result.scope;
  const specs = specsFor(scope);
  const data = (raw as { data: Record<string, unknown[]> }).data;

  const idsBySpec = new Map<string, Set<number>>();
  for (const spec of specs) {
    const ids = new Set<number>();
    for (const row of data[spec.key] ?? []) {
      const id = (row as Record<string, unknown>).id;
      if (typeof id === "number") ids.add(id);
    }
    idsBySpec.set(spec.key, ids);
  }

  const conn = await mysql.createConnection({ uri: url, timezone: "Z", multipleStatements: false });
  try {
    // Mirrors validateForMysql(): a truly empty/new database won't have
    // these tables yet, so create whatever's missing before touching them.
    // validate/import can be called independently (the import route
    // re-validates, but not every caller does), so this can't assume
    // validateForMysql already ran against this same connection.
    await ensureMysqlSchema(conn, scope);
    const anchor = specs[0];
    const [anchorRows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${anchor.sqlName}\``);
    const targetHasExistingData = (anchorRows[0]?.count as number) > 0;

    if (mode === "restore-empty" && targetHasExistingData) {
      throw new MysqlTargetHasDataError(anchor.sqlName);
    }

    await conn.beginTransaction();

    const wipedFirst: Record<string, number> = {};
    if (mode === "wipe-and-restore") {
      for (const spec of [...specs].reverse()) {
        const [countRows] = await conn.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM \`${spec.sqlName}\``);
        wipedFirst[spec.key] = countRows[0]?.count as number;
        await conn.query(`DELETE FROM \`${spec.sqlName}\``);
      }
    }

    const restored: Record<string, number> = {};
    for (const spec of specs) {
      const rows = (data[spec.key] ?? []) as Record<string, unknown>[];
      const columnNames = spec.columns.map((c) => `\`${c.sql}\``).join(", ");
      let created = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE).map((row) => sanitizeRow(spec.key, row, idsBySpec));
        if (!batch.length) continue;
        const values = batch.map((row) => convertRow(row, spec.columns));
        await conn.query(`INSERT INTO \`${spec.sqlName}\` (${columnNames}) VALUES ?`, [values]);
        created += batch.length;
      }
      restored[spec.key] = created;
    }

    await conn.commit();

    // Same reasoning as fullBackup.ts's resyncSerialSequence: done after
    // commit so it reflects what's actually on disk, and AUTO_INCREMENT
    // changes aren't meaningfully transactional in MySQL anyway.
    for (const spec of specs) {
      await resyncAutoIncrement(conn, spec);
    }

    return { scope, mode, restored, wipedFirst };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    await conn.end();
  }
}

function sanitizeRow(specKey: string, row: Record<string, unknown>, idsBySpec: Map<string, Set<number>>): Record<string, unknown> {
  const checks = FK_CHECKS[specKey];
  if (!checks) return row;
  let out = row;
  for (const [column, targetKey] of checks) {
    const value = out[column];
    if (typeof value !== "number") continue;
    const targetIds = idsBySpec.get(targetKey);
    if (targetIds && !targetIds.has(value)) out = { ...out, [column]: null };
  }
  return out;
}

async function resyncAutoIncrement(conn: Connection, spec: MysqlTableSpec): Promise<void> {
  if (NO_AUTO_INCREMENT.has(spec.key)) return;
  const [rows] = await conn.query<RowDataPacket[]>(`SELECT MAX(\`id\`) AS maxId FROM \`${spec.sqlName}\``);
  const maxId = rows[0]?.maxId as number | null;
  await conn.query(`ALTER TABLE \`${spec.sqlName}\` AUTO_INCREMENT = ?`, [(maxId ?? 0) + 1]);
}

async function main() {
  const { file, url, mode } = parseArgs();

  const raw = JSON.parse(readFileSync(file, "utf-8"));
  const result = validateBackupFile(raw);

  for (const issue of result.issues) {
    // eslint-disable-next-line no-console
    console.log(`[${issue.level}] ${issue.message}`);
  }
  if (!result.valid || !result.scope) {
    console.error(`\nValidation failed — no database was modified.`);
    process.exit(1);
  }

  try {
    const outcome = await restoreToMysql(raw, url, mode);
    console.log(`\nRestore completed successfully (scope: ${outcome.scope}, mode: ${outcome.mode})\n`);
    for (const key of Object.keys(outcome.restored)) {
      console.log(`  ${key}: ${outcome.restored[key]}${mode === "wipe-and-restore" ? ` (replaced ${outcome.wipedFirst[key] ?? 0})` : ""}`);
    }
  } catch (err) {
    if (err instanceof MysqlTargetHasDataError) {
      console.error(`${err.message} Re-run with --mode=wipe-and-restore to replace it.`);
      process.exit(1);
    }
    console.error("\nRestore failed — transaction rolled back, database unchanged.");
    console.error(err);
    process.exitCode = 1;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
