import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  db,
  ensureSchema,
  institutionsTable,
  programsTable,
  academicYearsTable,
  batchesTable,
  blocksTable,
  modulesTable,
  subjectsTable,
  topicsTable,
  pastPapersTable,
  examsTable,
  mcqsTable,
  examQuestionsTable,
  flashcardsTable,
  resourcesTable,
  booksTable,
  teamMembersTable,
  membershipPlansTable,
  couponsTable,
  ospeBlocksTable,
  ospeModulesTable,
  ospeLearningMaterialsTable,
  ospeStationsTable,
  ospeExamsTable,
  ospeExamStationsTable,
  platformSettingsTable,
  usersTable,
  studentDocumentsTable,
  paymentsTable,
  membershipsTable,
  bookPurchasesTable,
  practiceAttemptsTable,
  practiceAnswersTable,
  studentProgressTable,
  challengesTable,
  challengeAttemptsTable,
  notebookEntriesTable,
  bookHighlightsTable,
  bookReadingProgressTable,
  savedSessionsTable,
  flaggedMcqsTable,
  feedbackTable,
  feedbackRepliesTable,
  notificationsTable,
  notificationDismissalsTable,
  examAttemptsTable,
  examAnswersTable,
  ospeExamAttemptsTable,
  ospeExamAnswersTable,
  aiVisualizerLogsTable,
} from "@workspace/db";

// ---------------------------------------------------------------------------
// Whole-database JSON backup/restore — distinct from mcqBackup.ts/
// flashcardBackup.ts (one bank each). This walks EVERY application table
// (two groups — see below) so the whole platform can be recreated on a
// fresh database: the migration path this exists for is PostgreSQL/Supabase
// → MySQL (or any other server change), by re-importing the same JSON once
// a MySQL build of the importer exists. Nothing here is MySQL-specific —
// it's plain JSON, normalized dates, no Postgres-only types — that's the
// point: the export is the portable artifact, independent of which
// database wrote it or reads it back.
//
// Two separately downloadable groups, same idea as mcqBackupApi's whole-
// bank export but at the whole-platform level:
//
//  - CONTENT_TABLES: curriculum + platform configuration. No student PII.
//    Safe to hand to a co-admin, store in a repo, etc.
//  - USER_TABLES: every student's account + activity. Split out on purpose
//    (see AI_HANDOFF-style precedent in mcq-backup's "advanced" export in
//    the admin UI) since restoring/sharing this is a materially bigger
//    deal than restoring the question bank.
//
// Row order within each group is dependency order (a row is never exported
// or restored before something it points at via a foreign key), so a
// restore into an empty database never hits a dangling reference.
// ---------------------------------------------------------------------------

export const FULL_BACKUP_FORMAT_VERSION = 1;
export const APPLICATION_NAME = "MedSchoolProffs";

interface TableSpec {
  key: string;
  table: PgTable;
  /** The literal Postgres table name (pgTable()'s first arg) — used for the
   * post-restore sequence resync, where we need a plain identifier rather
   * than a Drizzle table reference. */
  sqlName: string;
  /** Platform settings only: rows whose `key` looks like a secret get their `value` replaced on export. */
  redactSettingSecrets?: boolean;
}

// Order matters — see the comment block above.
export const CONTENT_TABLES: TableSpec[] = [
  { key: "institutions", table: institutionsTable, sqlName: "med_institutions" },
  { key: "programs", table: programsTable, sqlName: "med_programs" },
  { key: "academicYears", table: academicYearsTable, sqlName: "med_academic_years" },
  { key: "batches", table: batchesTable, sqlName: "med_batches" },
  { key: "blocks", table: blocksTable, sqlName: "med_blocks" },
  { key: "modules", table: modulesTable, sqlName: "med_modules" },
  { key: "subjects", table: subjectsTable, sqlName: "med_subjects" },
  { key: "topics", table: topicsTable, sqlName: "med_topics" },
  { key: "pastPapers", table: pastPapersTable, sqlName: "med_past_papers" },
  { key: "exams", table: examsTable, sqlName: "med_exams" },
  { key: "mcqs", table: mcqsTable, sqlName: "med_mcqs" },
  { key: "examQuestions", table: examQuestionsTable, sqlName: "med_exam_questions" },
  { key: "flashcards", table: flashcardsTable, sqlName: "med_flashcards" },
  { key: "resources", table: resourcesTable, sqlName: "med_resources" },
  { key: "books", table: booksTable, sqlName: "med_books" },
  { key: "teamMembers", table: teamMembersTable, sqlName: "med_team_members" },
  { key: "membershipPlans", table: membershipPlansTable, sqlName: "med_membership_plans" },
  { key: "coupons", table: couponsTable, sqlName: "med_coupons" },
  { key: "ospeBlocks", table: ospeBlocksTable, sqlName: "med_ospe_blocks" },
  { key: "ospeModules", table: ospeModulesTable, sqlName: "med_ospe_modules" },
  { key: "ospeLearningMaterials", table: ospeLearningMaterialsTable, sqlName: "med_ospe_learning_materials" },
  { key: "ospeStations", table: ospeStationsTable, sqlName: "med_ospe_stations" },
  { key: "ospeExams", table: ospeExamsTable, sqlName: "med_ospe_exams" },
  { key: "ospeExamStations", table: ospeExamStationsTable, sqlName: "med_ospe_exam_stations" },
  { key: "platformSettings", table: platformSettingsTable, sqlName: "med_platform_settings", redactSettingSecrets: true },
];

// Deliberately excluded from every backup, content or user: med_user_sessions
// (live device sessions — a JWT `sid` a restore can't recreate meaningfully),
// med_email_verification_tokens / med_password_reset_tokens (single-use,
// short-lived, worthless once copied), med_payment_webhook_events (raw
// gateway payloads, replayable secrets, not needed to reconstruct state —
// the derived med_payments rows are what's exported), and med_audit_logs
// (an activity trail of THIS server, not portable data the app needs).
export const USER_TABLES: TableSpec[] = [
  { key: "users", table: usersTable, sqlName: "med_users" },
  { key: "studentDocuments", table: studentDocumentsTable, sqlName: "med_student_documents" },
  { key: "payments", table: paymentsTable, sqlName: "med_payments" },
  { key: "memberships", table: membershipsTable, sqlName: "med_memberships" },
  { key: "bookPurchases", table: bookPurchasesTable, sqlName: "med_book_purchases" },
  { key: "practiceAttempts", table: practiceAttemptsTable, sqlName: "med_practice_attempts" },
  { key: "practiceAnswers", table: practiceAnswersTable, sqlName: "med_practice_answers" },
  { key: "studentProgress", table: studentProgressTable, sqlName: "med_student_progress" },
  { key: "challenges", table: challengesTable, sqlName: "med_challenges" },
  { key: "challengeAttempts", table: challengeAttemptsTable, sqlName: "med_challenge_attempts" },
  { key: "notebookEntries", table: notebookEntriesTable, sqlName: "med_notebook_entries" },
  { key: "bookHighlights", table: bookHighlightsTable, sqlName: "med_book_highlights" },
  { key: "bookReadingProgress", table: bookReadingProgressTable, sqlName: "med_book_reading_progress" },
  { key: "savedSessions", table: savedSessionsTable, sqlName: "med_saved_sessions" },
  { key: "flaggedMcqs", table: flaggedMcqsTable, sqlName: "med_flagged_mcqs" },
  { key: "feedback", table: feedbackTable, sqlName: "med_feedback" },
  { key: "feedbackReplies", table: feedbackRepliesTable, sqlName: "med_feedback_replies" },
  { key: "notifications", table: notificationsTable, sqlName: "med_notifications" },
  { key: "notificationDismissals", table: notificationDismissalsTable, sqlName: "med_notification_dismissals" },
  { key: "examAttempts", table: examAttemptsTable, sqlName: "med_exam_attempts" },
  { key: "examAnswers", table: examAnswersTable, sqlName: "med_exam_answers" },
  { key: "ospeExamAttempts", table: ospeExamAttemptsTable, sqlName: "med_ospe_exam_attempts" },
  { key: "ospeExamAnswers", table: ospeExamAnswersTable, sqlName: "med_ospe_exam_answers" },
  { key: "aiVisualizerLogs", table: aiVisualizerLogsTable, sqlName: "med_ai_visualizer_logs" },
];

export type BackupScopeName = "content" | "users";

function specsFor(scope: BackupScopeName): TableSpec[] {
  return scope === "content" ? CONTENT_TABLES : USER_TABLES;
}

// Platform settings can hold provider API keys/secrets (AI_API_KEY, Brevo,
// Cloudinary, SMTP password, the admin-signup invite code...) saved via
// Admin → Settings. A content backup is meant to be shareable/storable —
// never dump those. Matches the same secret-shaped-key heuristic as
// SECRET_KEYS in routes/settings.ts, generalized so a future secret setting
// is redacted automatically rather than needing this list updated by hand.
const SECRET_SETTING_PATTERN = /API_KEY|API_SECRET|_PASS$|SECRET|SIGNUP_CODE/i;
export const REDACTED_SECRET_PLACEHOLDER = "__REDACTED__";

function redactSettingRow(row: Record<string, unknown>): Record<string, unknown> {
  const key = typeof row.key === "string" ? row.key : "";
  if (!SECRET_SETTING_PATTERN.test(key) || !row.value) return row;
  return { ...row, value: REDACTED_SECRET_PLACEHOLDER };
}

// Student login credentials never leave the database they were hashed in —
// bcrypt hashes are portable in principle, but shipping them in a backup
// file that might get emailed, committed, or restored somewhere less
// trusted is not a trade worth making for a convenience export. Every user
// row keeps its id/email/profile so accounts, progress, and payments all
// still line up after a restore; passwordHash is replaced with a
// placeholder and every student picks up where they left off via "Forgot
// password" (or an admin resets it) on the restored install.
function redactUserRow(row: Record<string, unknown>): Record<string, unknown> {
  return { ...row, passwordHash: REDACTED_SECRET_PLACEHOLDER };
}

export interface FullBackupFile {
  formatVersion: number;
  application: string;
  scope: BackupScopeName;
  exportedAt: string;
  source: { database: "postgresql" };
  counts: Record<string, number>;
  data: Record<string, Record<string, unknown>[]>;
}

export async function buildFullBackup(scope: BackupScopeName): Promise<FullBackupFile> {
  const specs = specsFor(scope);
  const data: Record<string, Record<string, unknown>[]> = {};
  const counts: Record<string, number> = {};
  for (const spec of specs) {
    const rows = (await db.select().from(spec.table)) as Record<string, unknown>[];
    const cleaned = spec.redactSettingSecrets
      ? rows.map(redactSettingRow)
      : scope === "users" && spec.key === "users"
        ? rows.map(redactUserRow)
        : rows;
    data[spec.key] = cleaned;
    counts[spec.key] = cleaned.length;
  }
  return {
    formatVersion: FULL_BACKUP_FORMAT_VERSION,
    application: APPLICATION_NAME,
    scope,
    exportedAt: new Date().toISOString(),
    source: { database: "postgresql" },
    counts,
    data,
  };
}

// ---------------------------------------------------------------------------
// Validation — read-only. Never touches the database beyond the one COUNT
// query that checks whether the target tables already hold data.
// ---------------------------------------------------------------------------

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
  targetHasExistingData: boolean;
}

// Every foreign-key-shaped column this validator checks, per table key —
// [column name in the row, table key it must resolve against]. Deliberately
// only the relationships that matter for "would a restore orphan a row"
// (curriculum tree + the handful of cross-scope links restore actually
// relies on); not every column in the schema.
const FK_CHECKS: Record<string, Array<[string, string]>> = {
  programs: [["institutionId", "institutions"]],
  academicYears: [["programId", "programs"]],
  batches: [["academicYearId", "academicYears"]],
  modules: [["blockId", "blocks"]],
  subjects: [["moduleId", "modules"]],
  topics: [["subjectId", "subjects"]],
  mcqs: [["moduleId", "modules"], ["subjectId", "subjects"], ["topicId", "topics"], ["pastPaperId", "pastPapers"], ["examId", "exams"]],
  examQuestions: [["examId", "exams"], ["mcqId", "mcqs"]],
  flashcards: [["moduleId", "modules"], ["subjectId", "subjects"], ["topicId", "topics"]],
  ospeModules: [["blockId", "ospeBlocks"]],
  ospeStations: [["moduleId", "ospeModules"], ["blockId", "ospeBlocks"]],
  ospeExamStations: [["examId", "ospeExams"], ["stationId", "ospeStations"]],
  payments: [["userId", "users"]],
  memberships: [["userId", "users"]],
  bookPurchases: [["userId", "users"], ["bookId", "books"]],
  practiceAttempts: [["userId", "users"]],
  practiceAnswers: [["attemptId", "practiceAttempts"], ["mcqId", "mcqs"]],
  studentProgress: [["userId", "users"], ["moduleId", "modules"]],
  challenges: [["challengerId", "users"], ["opponentId", "users"]],
  challengeAttempts: [["challengeId", "challenges"], ["userId", "users"]],
  notebookEntries: [["userId", "users"]],
  bookHighlights: [["userId", "users"], ["bookId", "books"]],
  bookReadingProgress: [["userId", "users"], ["bookId", "books"]],
  savedSessions: [["userId", "users"]],
  flaggedMcqs: [["userId", "users"], ["mcqId", "mcqs"]],
  feedbackReplies: [["feedbackId", "feedback"], ["authorId", "users"]],
  notificationDismissals: [["userId", "users"], ["notificationId", "notifications"]],
  examAttempts: [["examId", "exams"], ["userId", "users"]],
  examAnswers: [["attemptId", "examAttempts"], ["mcqId", "mcqs"]],
  ospeExamAttempts: [["examId", "ospeExams"], ["userId", "users"]],
  ospeExamAnswers: [["attemptId", "ospeExamAttempts"], ["stationId", "ospeStations"]],
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export async function validateFullBackup(raw: unknown): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  if (!isPlainObject(raw)) {
    return { valid: false, scope: null, exportedAt: null, counts: {}, issues: [{ level: "error", message: "File is not a valid backup — not a JSON object." }], targetHasExistingData: false };
  }
  const file = raw as Partial<FullBackupFile>;

  if (file.application !== APPLICATION_NAME) {
    issues.push({ level: "error", message: `This doesn't look like a ${APPLICATION_NAME} backup (missing or wrong "application" field).` });
  }
  if (typeof file.formatVersion !== "number") {
    issues.push({ level: "error", message: "Missing formatVersion." });
  } else if (file.formatVersion > FULL_BACKUP_FORMAT_VERSION) {
    issues.push({ level: "error", message: `This backup was made by a newer version of the app (format v${file.formatVersion}) and can't be safely restored here (this server supports up to v${FULL_BACKUP_FORMAT_VERSION}).` });
  }
  const scope: BackupScopeName | null = file.scope === "content" || file.scope === "users" ? file.scope : null;
  if (!scope) issues.push({ level: "error", message: 'Missing or invalid "scope" — expected "content" or "users".' });
  if (!isPlainObject(file.data)) issues.push({ level: "error", message: "Missing data section." });

  const counts: Record<string, number> = {};
  let targetHasExistingData = false;

  if (scope && isPlainObject(file.data)) {
    const specs = specsFor(scope);
    const idsBySpec = new Map<string, Set<number>>();

    for (const spec of specs) {
      const rows = file.data[spec.key];
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
      const rows = file.data[spec.key];
      if (!Array.isArray(rows)) continue;
      for (const check of checks) {
        const [column, targetKey] = check;
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

    // Does the target database already hold data for this scope? Checked
    // against the first table in the scope's own dependency chain
    // (institutions for content, users for user data) — enough to answer
    // "empty or not" without scanning every table.
    //
    // On a brand-new/empty Supabase database, none of these tables exist
    // yet, so this COUNT(*) would throw before anything useful happens.
    // ensureSchema() (the same idempotent CREATE TABLE/ALTER ... IF NOT
    // EXISTS script the app already runs at boot — see
    // lib/db/src/ensureSchema.ts) creates whatever's missing first. It's a
    // no-op against a database that already has the schema, so this is
    // safe to call on every validate, not just the empty-database case.
    const anchor = specs[0];
    await ensureSchema();
    const [{ count }] = (await db.execute(sql`select count(*)::int as count from ${anchor.table}`)).rows as Array<{ count: number }>;
    targetHasExistingData = count > 0;
  }

  return {
    valid: issues.every((i) => i.level !== "error"),
    scope,
    exportedAt: typeof file.exportedAt === "string" ? file.exportedAt : null,
    counts,
    issues,
    targetHasExistingData,
  };
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

export interface RestoreResult {
  scope: BackupScopeName;
  mode: "restore-empty" | "wipe-and-restore";
  restored: Record<string, number>;
  wipedFirst: Record<string, number>;
}

const INSERT_BATCH_SIZE = 500;

// Drops a foreign-key-shaped value that no longer resolves within this
// import (see FK_CHECKS above) rather than letting the whole row's insert
// fail — matches the validator's warning ("those references will be
// dropped on restore") instead of aborting an otherwise-good restore over
// one dangling pointer.
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

// Tables keyed by something other than a serial `id` (platformSettings uses
// its text `key` as primary key; bookReadingProgress uses a composite
// userId+bookId key — see schema/medschool.ts's bookReadingProgressTable)
// — neither has anything to resync, and pg_get_serial_sequence() throws
// ("column \"id\" ... does not exist") if called on a table that has no
// `id` column at all, rather than just returning null. Keep this in sync
// with the MySQL importer's equivalent NO_AUTO_INCREMENT set in
// scripts/src/mysql-restore/tableMeta.ts.
const NO_SERIAL_ID = new Set(["platformSettings", "bookReadingProgress"]);

// After inserting rows with explicit ids into a `serial` primary key,
// Postgres's own auto-increment sequence hasn't moved — the next unrelated
// INSERT (no explicit id) would collide with a restored row. Reset every
// table's sequence to max(id) right after restoring it, same as any
// Postgres bulk-load-with-explicit-ids guide recommends. sqlName is a
// fixed, hardcoded literal from the table specs above (never user input),
// so building the identifier with sql.raw here is safe.
async function resyncSerialSequence(spec: TableSpec): Promise<void> {
  if (NO_SERIAL_ID.has(spec.key)) return;
  await db.execute(sql.raw(`
    select setval(
      pg_get_serial_sequence('${spec.sqlName}', 'id'),
      coalesce((select max(id) from ${spec.sqlName}), 1),
      (select max(id) from ${spec.sqlName}) is not null
    )
  `));
}

export async function restoreFullBackup(file: FullBackupFile, mode: "restore-empty" | "wipe-and-restore"): Promise<RestoreResult> {
  // Defense in depth: the /admin/full-backup/import route always calls
  // validateFullBackup() (which itself now calls ensureSchema()) first, but
  // restoreFullBackup() is exported and callable on its own — this can't
  // assume some other code path already prepared the schema on this
  // connection.
  await ensureSchema();

  const specs = specsFor(file.scope);
  const restored: Record<string, number> = {};
  const wipedFirst: Record<string, number> = {};
  const idsBySpec = new Map<string, Set<number>>();
  for (const spec of specs) {
    const ids = new Set<number>();
    for (const row of file.data[spec.key] ?? []) {
      if (typeof (row as Record<string, unknown>).id === "number") ids.add((row as Record<string, unknown>).id as number);
    }
    idsBySpec.set(spec.key, ids);
  }

  await db.transaction(async (tx) => {
    if (mode === "wipe-and-restore") {
      // Reverse dependency order so a table is always emptied before
      // whatever it points at.
      for (const spec of [...specs].reverse()) {
        const [{ count }] = (await tx.execute(sql`select count(*)::int as count from ${spec.table}`)).rows as Array<{ count: number }>;
        wipedFirst[spec.key] = count;
        await tx.execute(sql`delete from ${spec.table}`);
      }
    }

    for (const spec of specs) {
      const rows = (file.data[spec.key] ?? []).map((row) => sanitizeRow(spec.key, row as Record<string, unknown>, idsBySpec));
      let created = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        if (!batch.length) continue;
        await tx.insert(spec.table).values(batch as never[]);
        created += batch.length;
      }
      restored[spec.key] = created;
    }
  });

  // Sequence resync happens outside the transaction (setval isn't
  // transactional in any way that matters here, and doing it after commit
  // means it always reflects what's actually on disk).
  for (const spec of specs) {
    await resyncSerialSequence(spec);
  }

  return { scope: file.scope, mode, restored, wipedFirst };
}
