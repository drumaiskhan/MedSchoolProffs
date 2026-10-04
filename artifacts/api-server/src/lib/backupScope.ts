import { eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { db, blocksTable, modulesTable, subjectsTable, topicsTable } from "@workspace/db";

// ---------------------------------------------------------------------------
// Shared by mcqBackup.ts and flashcardBackup.ts: lets a whole-bank backup be
// narrowed to one branch of the curriculum tree (Year > Block > Module >
// Subject > Topic) instead of always exporting/restoring everything. Both
// mcqsTable and flashcardsTable carry the same moduleId/subjectId/topicId
// columns, so this works against either by taking those columns as input
// rather than depending on one specific table.
// ---------------------------------------------------------------------------

// "program" = every year of one program (e.g. all of MBBS) — id is unused (0).
// "year" can additionally carry a `program` filter so "Year 2" can mean
// "MBBS Year 2" rather than "Year 2 of every program".
export const BACKUP_SCOPE_LEVELS = ["program", "year", "block", "module", "subject", "topic"] as const;
export type BackupScopeLevel = (typeof BACKUP_SCOPE_LEVELS)[number];

// "SHARED" = content with no program targeting at all (visible to MBBS and BDS
// alike) — the third bucket next to the two real programs.
export const BACKUP_PROGRAMS = ["MBBS", "BDS", "SHARED"] as const;
export type BackupProgram = (typeof BACKUP_PROGRAMS)[number];

// `id` is the block/module/subject/topic's row id for those four levels, or
// the academic year number (1-5) itself for level "year" — years aren't a
// table of their own, just a yearTargetNumber column on blocks/modules (see
// medschool.ts). `label` is a human-readable description (e.g. "Year 2",
// "Anatomy") carried along purely for filenames and confirmation copy —
// never trusted for filtering, which always goes by level+id.
export interface BackupScope {
  level: BackupScopeLevel;
  id: number;
  label: string;
  // Only meaningful for level "program" (required) and "year" (optional).
  program?: BackupProgram;
}

// Does a row carrying its own programTargetKind + yearTargetNumber (past
// papers, exams — and modules/blocks once their parent fallback is applied)
// fall under a "program" / "year" scope? Exact match: a row with no program
// targeting only matches the "SHARED" bucket (or no program filter at all).
export function targetingMatchesScope(
  scope: BackupScope,
  row: { programTargetKind: string | null; yearTargetNumber: number | null },
): boolean {
  if (scope.level !== "year" && scope.level !== "program") return false;
  if (scope.level === "year" && row.yearTargetNumber !== scope.id) return false;
  if (!scope.program) return true;
  return scope.program === "SHARED" ? row.programTargetKind == null : row.programTargetKind === scope.program;
}

// A scope's `label` free-text ends up in a JSON backup file, a downloaded
// filename, and a confirmation dialog — keep it short and plain so none of
// those get an unwieldy or malformed string.
export function sanitizeScopeLabel(label: string): string {
  return label.trim().slice(0, 80) || "scope";
}

// Resolves "program", "year" and "block" scopes down to the module ids they
// cover — "module"/"subject"/"topic" scopes match their own id column directly
// and never need this. A module's effective year/program is its own
// yearTargetNumber/programTargetKind, falling back to its parent block's when
// the module doesn't target one itself — the same fallback the admin UI's
// bank tree and block picker use to group things by Program · Year (see
// shared.tsx's groupBlocksForPicker).
export async function resolveModuleIdsForScope(scope: BackupScope): Promise<number[]> {
  if (scope.level === "block") {
    const rows = await db.select({ id: modulesTable.id }).from(modulesTable).where(eq(modulesTable.blockId, scope.id));
    return rows.map((r) => r.id);
  }
  const [allBlocks, allModules] = await Promise.all([
    db.select({ id: blocksTable.id, yearTargetNumber: blocksTable.yearTargetNumber, programTargetKind: blocksTable.programTargetKind }).from(blocksTable),
    db.select({ id: modulesTable.id, blockId: modulesTable.blockId, yearTargetNumber: modulesTable.yearTargetNumber, programTargetKind: modulesTable.programTargetKind }).from(modulesTable),
  ]);
  const blockById = new Map(allBlocks.map((b) => [b.id, b] as const));
  return allModules
    .filter((m) => {
      const parent = m.blockId != null ? blockById.get(m.blockId) : undefined;
      return targetingMatchesScope(scope, {
        yearTargetNumber: m.yearTargetNumber ?? parent?.yearTargetNumber ?? null,
        programTargetKind: m.programTargetKind ?? parent?.programTargetKind ?? null,
      });
    })
    .map((m) => m.id);
}

// Builds the WHERE clause matching mcqsTable/flashcardsTable rows under a
// scope. Returns undefined for no scope (caller should just skip filtering
// — "the whole bank" isn't expressible as a SQL condition).
export async function buildScopeWhere(
  scope: BackupScope,
  columns: { moduleId: PgColumn; subjectId: PgColumn; topicId: PgColumn },
): Promise<SQL> {
  switch (scope.level) {
    case "topic":
      return eq(columns.topicId, scope.id);
    case "subject":
      return eq(columns.subjectId, scope.id);
    case "module":
      return eq(columns.moduleId, scope.id);
    case "block":
    case "program":
    case "year": {
      const moduleIds = await resolveModuleIdsForScope(scope);
      // No modules fall under this block/year (e.g. an empty new block) —
      // match nothing rather than accidentally falling through to
      // "everything", which inArray([]) would otherwise risk depending on
      // the driver.
      if (!moduleIds.length) return sql`false`;
      return inArray(columns.moduleId, moduleIds);
    }
  }
}

// Looks a scope's id up against its own table to produce a friendly label
// for the export filename/UI when the caller (the export route) only has
// level+id from query params, not the record itself. Falls back to a
// generic label if the row can't be found (e.g. stale id) — export can
// still proceed against whatever rows still match.
export async function describeScope(level: BackupScopeLevel, id: number): Promise<string> {
  switch (level) {
    case "program":
      return "All years";
    case "year":
      return `Year ${id}`;
    case "block": {
      const [row] = await db.select({ name: blocksTable.name }).from(blocksTable).where(eq(blocksTable.id, id)).limit(1);
      return row?.name ?? `Block #${id}`;
    }
    case "module": {
      const [row] = await db.select({ name: modulesTable.name }).from(modulesTable).where(eq(modulesTable.id, id)).limit(1);
      return row?.name ?? `Module #${id}`;
    }
    case "subject": {
      const [row] = await db.select({ name: subjectsTable.name }).from(subjectsTable).where(eq(subjectsTable.id, id)).limit(1);
      return row?.name ?? `Subject #${id}`;
    }
    case "topic": {
      const [row] = await db.select({ name: topicsTable.name }).from(topicsTable).where(eq(topicsTable.id, id)).limit(1);
      return row?.name ?? `Topic #${id}`;
    }
  }
}

// A filesystem-safe slug of a scope's label, for the downloaded file name.
export function scopeFilenamePart(scope: BackupScope | null): string {
  if (!scope) return "full";
  // Program/year labels already read "MBBS · Year 2" — slugging the label alone
  // gives "mbbs-year-2", so the level prefix would just be noise.
  if (scope.level === "program" || scope.level === "year") {
    const label = scope.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    return label || `${scope.level}-${scope.id}`;
  }
  const slug = scope.label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `${scope.level}-${slug || scope.id}`;
}
