import { specsFor, FK_CHECKS, type BackupScopeName } from "./tableMeta.js";

// ---------------------------------------------------------------------------
// The JSON-level checks from validateFullBackup() in
// artifacts/api-server/src/lib/fullBackup.ts, reimplemented here with zero
// database dependency (no `db`, no Postgres, no MySQL) so this MySQL tool
// doesn't need a live Postgres connection just to validate a file. The one
// thing the Postgres version also does — checking whether the *target*
// database already has rows for this scope — is done separately in
// restore.ts, against the actual MySQL connection, once the file has
// already passed these checks.
// ---------------------------------------------------------------------------

export const FULL_BACKUP_FORMAT_VERSION = 1;
export const APPLICATION_NAME = "MedSchoolProffs";

export interface ValidationIssue {
  level: "error" | "warning";
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  scope: BackupScopeName | null;
  exportedAt: string | null;
  counts: Record<string, number>;
  issues: ValidationIssue[];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function validateBackupFile(raw: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    return { valid: false, scope: null, exportedAt: null, counts: {}, issues: [{ level: "error", message: "File is not a valid backup — not a JSON object." }] };
  }
  const file = raw as Record<string, unknown>;

  if (file.application !== APPLICATION_NAME) {
    issues.push({ level: "error", message: `This doesn't look like a ${APPLICATION_NAME} backup (missing or wrong "application" field).` });
  }
  if (typeof file.formatVersion !== "number") {
    issues.push({ level: "error", message: "Missing formatVersion." });
  } else if (file.formatVersion > FULL_BACKUP_FORMAT_VERSION) {
    issues.push({ level: "error", message: `This backup was made by a newer format (v${file.formatVersion}) than this importer supports (v${FULL_BACKUP_FORMAT_VERSION}).` });
  }

  const scope: BackupScopeName | null = file.scope === "content" || file.scope === "users" ? (file.scope as BackupScopeName) : null;
  if (!scope) issues.push({ level: "error", message: 'Missing or invalid "scope" — expected "content" or "users".' });
  if (!isPlainObject(file.data)) issues.push({ level: "error", message: "Missing data section." });

  const counts: Record<string, number> = {};

  if (scope && isPlainObject(file.data)) {
    const data = file.data as Record<string, unknown>;
    const specs = specsFor(scope);
    const idsBySpec = new Map<string, Set<number>>();

    for (const spec of specs) {
      const rows = data[spec.key];
      if (!Array.isArray(rows)) {
        issues.push({ level: "error", message: `Missing or invalid "${spec.key}" section.` });
        continue;
      }
      counts[spec.key] = rows.length;
      const ids = new Set<number>();
      const seenDuplicate = new Set<number>();
      for (const row of rows) {
        if (!isPlainObject(row)) { issues.push({ level: "error", message: `"${spec.key}" contains a row that isn't an object.` }); continue; }
        const id = row.id;
        if (typeof id === "number") {
          if (ids.has(id) && !seenDuplicate.has(id)) { issues.push({ level: "error", message: `Duplicate id ${id} in "${spec.key}".` }); seenDuplicate.add(id); }
          ids.add(id);
        }
      }
      idsBySpec.set(spec.key, ids);
    }

    for (const spec of specs) {
      const checks = FK_CHECKS[spec.key];
      if (!checks) continue;
      const rows = data[spec.key];
      if (!Array.isArray(rows)) continue;
      for (const [column, targetKey] of checks) {
        const targetIds = idsBySpec.get(targetKey);
        if (!targetIds) continue;
        let missing = 0;
        for (const row of rows) {
          if (!isPlainObject(row)) continue;
          const value = row[column];
          if (value === null || value === undefined) continue;
          if (typeof value === "number" && !targetIds.has(value)) missing++;
        }
        if (missing > 0) issues.push({ level: "warning", message: `${missing} row(s) in "${spec.key}" reference a "${column}" not present in "${targetKey}" — those references will be dropped on restore.` });
      }
    }
  }

  return {
    valid: issues.every((i) => i.level !== "error"),
    scope,
    exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : null,
    counts,
    issues,
  };
}
