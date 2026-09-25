import type { ColumnMeta } from "./tableMeta.js";

// ---------------------------------------------------------------------------
// The backup JSON is plain, database-independent data (see
// artifacts/api-server/src/lib/fullBackup.ts's buildFullBackup): every value
// is already a JSON string/number/boolean/null/array/object — nothing
// Postgres-specific ever made it into the file. This module is the one place
// that turns those plain values into what mysql2 needs to bind for each
// column type. Nothing here reads or writes Postgres.
// ---------------------------------------------------------------------------

/**
 * Convert one row's values for insertion into MySQL, in column order, using
 * this table's column metadata to decide how each value needs to change.
 */
export function convertRow(row: Record<string, unknown>, columns: ColumnMeta[]): unknown[] {
  return columns.map((col) => convertValue(row[col.js], col));
}

function convertValue(value: unknown, col: ColumnMeta): unknown {
  if (value === null || value === undefined) return null;

  // Postgres text[]/integer[] columns (mcqs.options, .tags, .optionExplanations,
  // challenges.mcqIds, ospeStations.options) are plain JS arrays in the JSON —
  // MySQL has no array type, so these land in a JSON column instead.
  if (col.array) return JSON.stringify(value);

  switch (col.type) {
    case "json":
      // Postgres jsonb (ospeStations.labelPoints, ospeExamAnswers.labelAnswers)
      // is already a parsed object/array in the JSON file — MySQL's JSON
      // columns take a JSON *string* over the wire, not a bound JS object.
      return JSON.stringify(value);

    case "timestamp": {
      // buildFullBackup serializes every timestamp as a plain ISO-8601
      // string (Postgres `timestamp with time zone` -> JS Date -> JSON ->
      // ISO string). Hand mysql2 a Date object rather than the raw string
      // so it goes through one consistent formatting path; the connection
      // is opened with timezone: "Z" (see restore.ts) so that formatting
      // is UTC, matching what the ISO string already meant.
      if (typeof value === "string") return new Date(value);
      return value;
    }

    case "date":
      // Drizzle's `date(..., { mode: "string" })` columns (lastPracticeDate,
      // paymentDate) are already plain "YYYY-MM-DD" strings — MySQL's DATE
      // type accepts that exact format as-is.
      return value;

    case "boolean":
      // mysql2 would coerce a JS boolean itself, but converting explicitly
      // keeps the inserted value unambiguous (MySQL BOOLEAN is TINYINT(1)).
      return value ? 1 : 0;

    case "numeric":
      // Postgres `numeric` columns come back from Drizzle as strings (to
      // avoid float precision loss) and MySQL's DECIMAL accepts the same
      // string form directly — nothing to convert.
      return value;

    case "int":
    case "text":
    default:
      return value;
  }
}
