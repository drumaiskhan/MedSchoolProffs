// Ensures the MySQL schema needed to receive a MedSchoolProffs backup
// exists on the target database, using CREATE TABLE IF NOT EXISTS so it
// never touches, alters, or drops a table that's already there.
//
// Why this exists: restore.ts's very first move against the target is to
// COUNT(*) the anchor table, to decide whether the database already has
// data for this scope. Against a genuinely empty/new database — the "new
// Supabase-style" MySQL target this feature is for — that table doesn't
// exist yet, so the COUNT(*) throws before anything useful happens. Calling
// ensureMysqlSchema() first makes both validate and import work the same
// way against an empty database as they do against one that already has
// the MedSchoolProffs schema.
//
// Reuses the exact DDL generateSchema.ts emits for
// `pnpm run generate:mysql-schema`, so a database prepared automatically
// here and one prepared by hand from that script's output end up identical.
// Never destructive: CREATE TABLE IF NOT EXISTS is a no-op against a
// database that already has the schema, and this file never emits DROP,
// ALTER, or TRUNCATE.

import type { Connection } from "mysql2/promise";
import { specsFor, type BackupScopeName } from "./tableMeta.js";
import { createTableSql } from "./generateSchema.js";

/**
 * Creates any tables for `scope` that don't already exist on `conn`'s
 * database. Safe to call before every validate and every import — it only
 * ever adds missing tables, so re-running it against a database that
 * already has the schema (or already has data) changes nothing.
 */
export async function ensureMysqlSchema(conn: Connection, scope: BackupScopeName): Promise<void> {
  for (const spec of specsFor(scope)) {
    await conn.query(createTableSql(spec));
  }
}
