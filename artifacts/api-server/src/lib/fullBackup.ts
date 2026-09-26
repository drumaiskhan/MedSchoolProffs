import { sql, getTableColumns } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTable } from "drizzle-orm/pg-core";
import {
  db,
  pool,
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
  mcqImportProfilesTable,
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
import { logger } from "./logger";

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
  { key: "mcqImportProfiles", table: mcqImportProfilesTable, sqlName: "med_mcq_import_profiles" },
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

// "full" is every table from both groups, content first (dependency order
// preserved within each group) — the single-file migration path: everything
// needed to recreate the whole database on a fresh Postgres/Supabase (or,
// via full-backup-mysql.ts, MySQL) instance from one JSON. "content" and
// "users" stay available as separate, smaller exports for the cases that
// motivated the split in the first place (sharing/storing curriculum data
// without student PII, or restoring just one half).
export type BackupScopeName = "content" | "users" | "full";

// Keep in sync with ALL_TABLE_KEYS-style completeness checks elsewhere (see
// the "full" branch of buildFullBackup/validateFullBackup below, which walk
// this array) — anything added to CONTENT_TABLES or USER_TABLES is
// automatically included here too, so there's nothing to remember to update
// when a new table is added to either group.
export const ALL_TABLES: TableSpec[] = [...CONTENT_TABLES, ...USER_TABLES];

function specsFor(scope: BackupScopeName): TableSpec[] {
  if (scope === "content") return CONTENT_TABLES;
  if (scope === "users") return USER_TABLES;
  return ALL_TABLES;
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
      : spec.key === "users"
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
  // A student's institution/program/academicYear/batch pointers were never
  // checked here — every other table that points at content (modules,
  // subjects, mcqs, ...) has an entry above, but "users" was missing one.
  // That gap meant a "users"-scope restore silently kept whatever
  // institutionId/programId/academicYearId/batchId the backup had, even
  // when those ids no longer match anything in the target database (e.g.
  // the content side was wiped-and-restored from a different export, or
  // freshly reseeded, after this backup was taken) — students would land
  // on the wrong institution/program/year/batch, or a nonexistent one,
  // with zero warning from validate and zero error from restore, because
  // med_users.institution_id/program_id/academic_year_id/batch_id are
  // plain integer columns with no Postgres-level foreign key (see
  // schema/medschool.ts's usersTable) to catch it either.
  users: [["institutionId", "institutions"], ["programId", "programs"], ["academicYearId", "academicYears"], ["batchId", "batches"]],
};

// FK_CHECKS' targets are usually restored in the same file (e.g. "programs"
// checks against "institutions", both in CONTENT_TABLES together). But
// "users" checks against institutions/programs/academicYears/batches, which
// live in CONTENT_TABLES while users lives in USER_TABLES — on a
// "users"-scope restore (the common case: restoring student data into a
// database that already has its content), those target tables are never
// part of `specs`, so idsBySpec never gets an entry for them and the check
// above silently no-ops. This looks up a TableSpec by key across both
// groups so callers can fetch "what ids actually exist right now" for a
// target that isn't part of the current restore/validate scope.
const TABLE_SPEC_BY_KEY = new Map(ALL_TABLES.map((spec) => [spec.key, spec] as const));

// For every FK_CHECKS target that isn't already in idsBySpec (i.e. isn't
// part of the specs being restored/validated), query the live database for
// the ids that currently exist and add them — so a "users"-scope restore
// can actually catch/drop a dangling institution/program/academicYear/batch
// pointer instead of silently keeping it. Queried once per target table,
// via whichever runner (the plain db, or an in-transaction client) the
// caller is using, so restore sees this within its own transaction.
async function loadExternalIdSets(
  specs: TableSpec[],
  idsBySpec: Map<string, Set<number>>,
  runner: { execute: (q: ReturnType<typeof sql.raw>) => Promise<{ rows: unknown[] }> },
): Promise<void> {
  const neededKeys = new Set<string>();
  for (const spec of specs) {
    const checks = FK_CHECKS[spec.key];
    if (!checks) continue;
    for (const [, targetKey] of checks) {
      if (!idsBySpec.has(targetKey)) neededKeys.add(targetKey);
    }
  }
  for (const targetKey of neededKeys) {
    const targetSpec = TABLE_SPEC_BY_KEY.get(targetKey);
    if (!targetSpec || NO_SERIAL_ID.has(targetSpec.key)) continue;
    try {
      const result = await runner.execute(sql.raw(`select id from ${targetSpec.sqlName}`));
      const ids = new Set<number>();
      for (const row of result.rows as Array<{ id: number }>) ids.add(row.id);
      idsBySpec.set(targetKey, ids);
    } catch {
      // Target table doesn't exist yet (e.g. brand-new database with only
      // this restore's tables created so far) — leave it unset, same as
      // before this fix, rather than failing the whole validate/restore
      // over a table this scope doesn't even touch.
    }
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Auto-derived from lib/db/src/schema/medschool.ts (same idea as
// scripts/src/mysql-restore/tableMeta.ts's ColumnMeta, generated the same
// way): every JS property, per table key, backed by a real `timestamp(...)`
// column (Postgres `timestamp with time zone`, Drizzle's default Date mode).
// buildFullBackup serializes those as plain ISO-8601 strings (JSON has no
// Date type); a restore has to turn them back into JS `Date` objects before
// handing rows to Drizzle, or every insert throws
// "TypeError: value.toISOString is not a function" (PgTimestamp expects a
// Date, not a string). Columns built with `date(..., { mode: "string" })`
// (lastPracticeDate, paymentDate) are NOT in this map on purpose — those
// stay plain "YYYY-MM-DD" strings all the way through; converting them would
// be the same bug in the other direction. Regenerate this list by hand if a
// table gains/loses a timestamp column.
const TIMESTAMP_COLUMNS: Record<string, string[]> = {
  academicYears: ["createdAt", "updatedAt"],
  aiVisualizerLogs: ["createdAt", "updatedAt"],
  batches: ["createdAt", "updatedAt"],
  blocks: ["createdAt", "updatedAt"],
  bookHighlights: ["createdAt", "updatedAt"],
  bookPurchases: ["createdAt", "reviewedAt", "updatedAt"],
  bookReadingProgress: ["updatedAt"],
  books: ["createdAt", "updatedAt"],
  challengeAttempts: ["completedAt", "createdAt", "updatedAt"],
  challenges: ["createdAt", "expiresAt", "updatedAt"],
  coupons: ["createdAt", "expiresAt", "updatedAt"],
  examAnswers: ["createdAt", "updatedAt"],
  examAttempts: ["createdAt", "resultsReleasedAt", "startedAt", "submittedAt", "updatedAt"],
  examQuestions: ["createdAt", "updatedAt"],
  exams: ["createdAt", "endAt", "startAt", "updatedAt"],
  feedback: ["createdAt", "updatedAt"],
  feedbackReplies: ["createdAt", "updatedAt"],
  flaggedMcqs: ["createdAt", "updatedAt"],
  flashcards: ["createdAt", "updatedAt"],
  institutions: ["createdAt", "updatedAt"],
  mcqImportProfiles: ["createdAt", "updatedAt"],
  mcqs: ["createdAt", "updatedAt"],
  membershipPlans: ["createdAt", "updatedAt"],
  memberships: ["createdAt", "expiresAt", "startsAt", "updatedAt"],
  modules: ["createdAt", "updatedAt"],
  notebookEntries: ["createdAt", "updatedAt"],
  notificationDismissals: ["createdAt", "updatedAt"],
  notifications: ["createdAt", "updatedAt"],
  ospeBlocks: ["createdAt", "updatedAt"],
  ospeExamAnswers: ["aiGradedAt", "createdAt", "updatedAt"],
  ospeExamAttempts: ["createdAt", "resultsReleasedAt", "startedAt", "submittedAt", "updatedAt"],
  ospeExamStations: ["createdAt", "updatedAt"],
  ospeExams: ["createdAt", "endAt", "startAt", "updatedAt"],
  ospeLearningMaterials: ["createdAt", "updatedAt"],
  ospeModules: ["createdAt", "updatedAt"],
  ospeStations: ["createdAt", "updatedAt"],
  pastPapers: ["createdAt", "updatedAt"],
  payments: ["createdAt", "reviewedAt", "updatedAt"],
  platformSettings: ["createdAt", "updatedAt"],
  practiceAnswers: ["createdAt", "updatedAt"],
  practiceAttempts: ["completedAt", "createdAt", "startedAt", "updatedAt"],
  programs: ["createdAt", "updatedAt"],
  resources: ["createdAt", "updatedAt"],
  savedSessions: ["createdAt", "updatedAt"],
  studentDocuments: ["createdAt", "updatedAt"],
  studentProgress: ["createdAt", "lastActivityAt", "updatedAt"],
  subjects: ["createdAt", "updatedAt"],
  teamMembers: ["createdAt", "updatedAt"],
  topics: ["createdAt", "updatedAt"],
  users: ["createdAt", "lastLoginAt", "lockedUntil", "passwordChangedAt", "updatedAt"],
};

// Turns each of a row's ISO-string timestamp values into a JS Date, using
// TIMESTAMP_COLUMNS above so date(mode:"string") columns are left untouched.
// Throws on a value that isn't a valid date rather than silently handing
// Drizzle an Invalid Date (validateFullBackup below catches this same case
// ahead of time and reports it as an issue instead of an ISOString crash;
// this is defense in depth for restoreFullBackup being callable directly).
function convertTimestamps(specKey: string, row: Record<string, unknown>): Record<string, unknown> {
  const keys = TIMESTAMP_COLUMNS[specKey];
  if (!keys || keys.length === 0) return row;
  let out = row;
  for (const key of keys) {
    const value = out[key];
    if (value === null || value === undefined || value instanceof Date) continue;
    if (typeof value !== "string") continue;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`Invalid "${key}" timestamp ("${value}") in a "${specKey}" row — cannot restore.`);
    }
    if (out === row) out = { ...row };
    out[key] = date;
  }
  return out;
}

// Every column ensureSchema.ts adds via ALTER TABLE ... ADD COLUMN IF NOT
// EXISTS (i.e. every column added to a table *after* that table's original
// CREATE TABLE shipped) — kept in sync with lib/db/src/ensureSchema.ts by
// hand. A populated database can have all its tables but still be missing
// one of these if it hasn't restarted the API (which runs ensureSchema() at
// boot) since a newer column was added — "the tables exist" does not mean
// "the schema is current." Checking this cheaply is what lets validate/
// restore tell a genuinely-behind-on-migrations database apart from a
// current one, instead of assuming either "run the whole bootstrap every
// time" (see the statement-timeout problem this replaced) or "tables exist,
// must be fine" (silently missing columns → a confusing failure deep inside
// the restore's INSERTs instead of a clear message up front).
const ADDITIVE_COLUMNS: Array<[table: string, column: string]> = [
  ["med_mcq_import_profiles", "hint_pattern"],
  ["med_mcq_import_profiles", "reference_pattern"],
  ["med_feedback", "rating"],
  ["med_feedback", "featured"],
  ["med_mcqs", "option_explanations"],
  ["med_mcqs", "explanation_status"],
  ["med_mcqs", "hint"],
  ["med_mcqs", "exam_id"],
  ["med_ai_visualizer_logs", "raw_response"],
  ["med_membership_plans", "auto_renew"],
  ["med_membership_plans", "eligibility"],
  ["med_membership_plans", "original_price"],
  ["med_membership_plans", "discount_label"],
  ["med_modules", "block_id"],
  ["med_modules", "icon_path"],
  ["med_subjects", "icon_path"],
  ["med_team_members", "category"],
  ["med_institutions", "kind"],
  ["med_past_papers", "program_target_kind"],
  ["med_past_papers", "year_target_number"],
  ["med_books", "program_target_kind"],
  ["med_books", "year_target_number"],
  ["med_books", "is_free"],
  ["med_books", "price"],
  ["med_books", "currency"],
  ["med_payments", "coupon_code"],
  ["med_payments", "discount_amount"],
  ["med_memberships", "is_trial"],
  ["med_challenges", "block_id"],
  ["med_users", "status_message"],
  ["med_users", "max_devices"],
  ["med_ospe_stations", "label_points"],
  ["med_ospe_stations", "block_id"],
  ["med_ospe_learning_materials", "block_id"],
  ["med_ospe_exam_answers", "label_answers"],
];

// One cheap catalog query (information_schema.columns — no locks, nothing
// DDL) covering every additive column at once, rather than one to_regclass
// call per column.
async function findMissingAdditiveColumns(): Promise<Array<[string, string]>> {
  const rows = (
    await db.execute(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (${sql.join(
          ADDITIVE_COLUMNS.map(([t, c]) => sql`(${t}, ${c})`),
          sql`, `,
        )})
    `)
  ).rows as Array<{ table_name: string; column_name: string }>;
  const present = new Set(rows.map((r) => `${r.table_name}.${r.column_name}`));
  return ADDITIVE_COLUMNS.filter(([t, c]) => !present.has(`${t}.${c}`));
}

// Cheap catalog lookups (to_regclass + the information_schema query above)
// instead of unconditionally re-running the whole ensureSchema() bootstrap.
// ensureSchema() itself only ever runs when something is actually missing —
// a brand-new database (no anchor table yet) or an existing one that's
// behind on additive columns — and even then it's the same idempotent,
// purely-additive script (CREATE TABLE/ADD COLUMN IF NOT EXISTS) the app
// already runs at every boot, never anything destructive. See the long
// comment at this function's call site in validateFullBackup for why
// skipping it on an up-to-date database matters (this was the real cause of
// validation's statement-timeout / 500s, not the JSON size).
async function ensureSchemaIfMissing(anchor: TableSpec): Promise<void> {
  const [{ exists }] = (
    await db.execute(sql`select (to_regclass(${anchor.sqlName}) is not null) as exists`)
  ).rows as Array<{ exists: boolean }>;
  if (!exists) {
    await ensureSchema();
    return;
  }
  const missing = await findMissingAdditiveColumns();
  if (missing.length > 0) {
    logger.warn(
      { missing: missing.map(([t, c]) => `${t}.${c}`) },
      "[full-backup] schema is behind on additive columns — running ensureSchema() to catch it up before validating/restoring",
    );
    await ensureSchema();
  }
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
  const scope: BackupScopeName | null =
    file.scope === "content" || file.scope === "users" || file.scope === "full" ? file.scope : null;
  if (!scope) issues.push({ level: "error", message: 'Missing or invalid "scope" — expected "content", "users", or "full".' });
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
      const tsKeys = TIMESTAMP_COLUMNS[spec.key];
      const invalidTimestamps = new Map<string, number>();
      for (const row of rows) {
        if (!isPlainObject(row)) { issues.push({ level: "error", message: `"${spec.key}" contains a row that isn't an object.` }); continue; }
        const id = row.id;
        if (typeof id === "number") {
          if (ids.has(id) && !seenDuplicate.has(id)) { issues.push({ level: "error", message: `Duplicate id ${id} in "${spec.key}".` }); seenDuplicate.add(id); }
          ids.add(id);
        }
        if (tsKeys) {
          for (const key of tsKeys) {
            const value = row[key];
            if (typeof value !== "string" || value === "") continue;
            if (Number.isNaN(Date.parse(value))) invalidTimestamps.set(key, (invalidTimestamps.get(key) ?? 0) + 1);
          }
        }
      }
      for (const [key, count] of invalidTimestamps) {
        issues.push({ level: "error", message: `${count} row(s) in "${spec.key}" have an invalid "${key}" timestamp.` });
      }
      idsBySpec.set(spec.key, ids);
    }

    await loadExternalIdSets(specs, idsBySpec, db);

    for (const spec of specs) {
      const checks = FK_CHECKS[spec.key];
      if (!checks) continue;
      const rows = file.data[spec.key];
      if (!Array.isArray(rows)) continue;
      const notNullColumns = notNullFkColumns(spec);
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
        if (missing > 0) {
          // notNull: the column can't be cleared without violating the
          // schema, so restoring these rows at all isn't possible — the
          // whole row is skipped. Nullable: only the bad pointer is
          // cleared, the rest of the row still restores.
          const outcome = notNullColumns.has(column)
            ? `${missing} row(s) in "${spec.key}" reference a "${column}" not present in "${targetKey}" — "${column}" can't be empty, so those rows will be skipped on restore.`
            : `${missing} row(s) in "${spec.key}" reference a "${column}" not present in "${targetKey}" — that reference will be cleared on restore.`;
          issues.push({ level: "warning", message: outcome });
        }
      }
    }

    // Does the target database already hold data for this scope? This used
    // to check only the scope's first table (institutions for content/full,
    // users for user data) on the theory that was "enough to answer empty
    // or not" — but it isn't: seedDefaultAdmin() (see lib/seedAdmin.ts)
    // always creates exactly one admin row in med_users on any boot with no
    // existing admin, so med_users is never actually empty on a running
    // server even when every other table genuinely is. For a "full" or
    // "content" restore (anchor = institutions), that seeded admin row was
    // invisible to this check — it reported "empty", the UI offered the
    // non-destructive "Restore into this database" button, and the restore
    // would run cleanly through every table until it reached users and hit
    // a real Postgres "duplicate key value violates unique constraint
    // med_users_pkey" (the backup's own admin row almost always also has id
    // 1, since it was the first user in the source database too) —
    // collision, whole transaction rolled back, nothing restored. Checking
    // every table in the scope (not just the anchor) means that seeded
    // admin row is correctly seen as "this target already has data", so the
    // UI forces wipe-and-restore instead — which deletes it before
    // restoring, so the collision can't happen.
    const anchor = specs[0];
    await ensureSchemaIfMissing(anchor);
    for (const spec of specs) {
      const [{ count }] = (await db.execute(sql`select count(*)::int as count from ${spec.table}`)).rows as Array<{ count: number }>;
      if (count > 0) { targetHasExistingData = true; break; }
    }
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
// A dangling FK reference (per FK_CHECKS) gets cleared here rather than
// aborting an otherwise-good restore over one bad pointer — but only when
// the column can actually hold null. Real incident this fixes: mcqId on
// med_practice_answers is NOT NULL (a practice answer for no MCQ isn't
// meaningful data), so when a backup's practiceAnswers row pointed at an
// mcq id that had since been deleted from the live app (and so was never
// captured in the mcqs data restored alongside it), setting mcqId to null
// here just traded the FK problem for "null value in column \"mcq_id\" ...
// violates not-null constraint" — turning an otherwise-clean restore into
// a hard failure. For a NOT NULL column there's no value this function can
// put there that's both truthful and satisfies the schema, so the row
// itself can't be restored — this returns null (drop the whole row) for
// case, and only nulls the column when the schema actually allows it.
function sanitizeRow(specKey: string, row: Record<string, unknown>, idsBySpec: Map<string, Set<number>>, notNullColumns: Set<string>): Record<string, unknown> | null {
  const checks = FK_CHECKS[specKey];
  if (!checks) return row;
  let out = row;
  for (const [column, targetKey] of checks) {
    const value = out[column];
    if (typeof value !== "number") continue;
    const targetIds = idsBySpec.get(targetKey);
    if (!targetIds || targetIds.has(value)) continue;
    if (notNullColumns.has(column)) return null;
    out = { ...out, [column]: null };
  }
  return out;
}

// Which of a table's FK_CHECKS columns are NOT NULL in the actual schema —
// read from the Drizzle table definition itself (not hand-maintained)
// specifically so this can never drift out of sync with schema/medschool.ts
// the way the hand-picked NOT NULL assumption that caused the incident
// above did.
function notNullFkColumns(spec: TableSpec): Set<string> {
  const checks = FK_CHECKS[spec.key];
  if (!checks) return new Set();
  const columns = getTableColumns(spec.table) as Record<string, { notNull?: boolean }>;
  const result = new Set<string>();
  for (const [column] of checks) {
    if (columns[column]?.notNull) result.add(column);
  }
  return result;
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
  // validateFullBackup() (which itself now calls ensureSchemaIfMissing())
  // first, but restoreFullBackup() is exported and callable on its own —
  // this can't assume some other code path already prepared the schema on
  // this connection. Same reasoning as validateFullBackup: only actually
  // bootstrap the schema when the anchor table is genuinely missing, not
  // unconditionally on every restore.
  const specs = specsFor(file.scope);
  await ensureSchemaIfMissing(specs[0]);
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

  // Restoring ~30k+ rows across dozens of tables, each batch its own
  // round-trip to Postgres, can legitimately take well over a minute —
  // especially against a remote/pooled connection (Supabase) where each
  // round-trip carries real network latency, not just query time. With no
  // logging, that's indistinguishable from a genuine hang from the
  // terminal. One line per table (row count + elapsed time) is enough to
  // tell "it's working, just slow" apart from "it's stuck on X" — check
  // this log live in the terminal running the API while a restore shows
  // "Pending" in the browser; if it keeps advancing table by table, it's
  // just slow and will finish; if it stops dead on one line, that table's
  // insert (or a lock it's waiting on) is the actual problem.
  const totalRows = specs.reduce((sum, spec) => sum + (file.data[spec.key]?.length ?? 0), 0);
  logger.info({ scope: file.scope, mode, tables: specs.length, totalRows }, "[full-backup] restore starting");
  const restoreStarted = Date.now();

  // Manually-managed client/transaction instead of db.transaction(): if the
  // underlying connection dies mid-restore (network blip, the provider's
  // pooler killing a long-idle-in-transaction session, etc.), the client
  // MUST be released with that error passed to release(err) — that's the
  // node-postgres contract for telling the pool "this physical connection
  // is broken, destroy it" rather than "it's healthy, hand it to the next
  // request." drizzle-orm's own db.transaction() wrapper does not
  // consistently guarantee that error-aware release, which is a known
  // real-world failure mode: one dead connection gets quietly recycled back
  // into the pool, and every subsequent request that happens to draw it
  // fails with "Connection terminated unexpectedly" / "Connection
  // terminated due to connection timeout" until the process is restarted —
  // matching exactly what was seen after a restore here. Acquiring the
  // client ourselves and calling release(err) explicitly on any failure
  // closes that gap regardless of what drizzle's internals do.
  const client = await pool.connect();
  let released = false;
  // pg-pool contract: a truthy argument to release() tells the pool this
  // client is broken and to discard it instead of returning it to the idle
  // list. Anything caught here — Error or not — means treat the connection
  // as suspect; only a clean, no-argument release() on the success path
  // marks it as safe to reuse.
  const release = (err?: unknown) => {
    if (released) return;
    released = true;
    client.release(err ? (err instanceof Error ? err : true) : undefined);
  };
  try {
    const tx = drizzle(client);
    await client.query("BEGIN");

    // Nothing in this codebase ever set statement_timeout on the connection
    // that runs this transaction — the earlier "canceling statement due to
    // statement timeout" fix (see ensureSchemaIfMissing above) works by
    // avoiding the expensive DDL, not by bounding the timeout, so it does
    // NOT protect this transaction's own inserts. Left unset, this
    // transaction runs with whatever statement_timeout the role/database
    // defaults to — which can be unlimited (0) on a local/Docker Postgres —
    // meaning a genuine lock wait here (e.g. another connection holding a
    // lock on med_mcqs) would hang forever with no error, indistinguishable
    // from JS just being slow. SET LOCAL scopes this to the current
    // transaction only (resets automatically at COMMIT/ROLLBACK — never
    // leaks to the pooled connection's next user), so this is safe without
    // touching the database's or role's global setting. A bounded-but-
    // generous timeout (not 0/unlimited) means a real stuck lock fails
    // loudly with a clear Postgres error instead of hanging indefinitely.
    const statementTimeoutMs = Number(process.env.RESTORE_STATEMENT_TIMEOUT_MS) || 600_000; // 10 min default
    await tx.execute(sql.raw(`SET LOCAL statement_timeout = ${statementTimeoutMs}`));
    logger.info({ statementTimeoutMs }, "[full-backup] transaction begin (BEGIN issued, statement_timeout set)");

    // See loadExternalIdSets: for a "users"-scope restore this pulls in the
    // institutions/programs/academicYears/batches ids that already exist in
    // this database (they're not part of this file's own data), so the
    // sanitizeRow() calls below can actually drop a dangling
    // institution/program/academicYear/batch pointer on a student row
    // instead of always leaving it untouched.
    await loadExternalIdSets(specs, idsBySpec, tx);

    // Hold a write lock on every table this restore touches, for the whole
    // transaction, acquired up front in a fixed (alphabetical) order.
    //
    // Real incident this fixes: a "wipe-and-restore" of mcqs succeeded at
    // wiping and at inserting the backup's own rows (which can never
    // collide with each other — a live database can't have had two rows
    // sharing a primary key for the export to have captured in the first
    // place), and STILL hit "duplicate key value violates unique constraint
    // med_mcqs_pkey". The only way that happens: something else inserted a
    // new row into med_mcqs on a different connection while this
    // transaction was still open (this restore logs "well over a minute"
    // for 30k+ rows — plenty of time for the admin panel's Add MCQ, the AI
    // MCQ generator, or the bulk MCQ importer to run concurrently). That
    // insert draws its id from med_mcqs_id_seq, which isn't resynced until
    // *after* this transaction commits (see resyncSerialSequence below) —
    // so mid-restore it can still hand out a low id that the backup is
    // also about to insert explicitly. Whichever commits first wins; the
    // restore's own insert of that same id then hits a real Postgres
    // unique-constraint violation, even though everything this
    // transaction itself did was internally consistent.
    //
    // EXCLUSIVE mode blocks INSERT/UPDATE/DELETE from every other session
    // (so nothing can hand out a colliding id, or observe a half-restored
    // table, until COMMIT) while still allowing plain SELECTs to go
    // through — students browsing MCQs mid-restore aren't blocked. Locks
    // are released automatically at COMMIT/ROLLBACK; acquiring them in one
    // fixed order (alphabetical by table name) up front, rather than
    // per-table as each is wiped, means a second restore running at the
    // same time will always request the same tables in the same order —
    // it blocks and waits its turn instead of risking a deadlock.
    const lockOrder = [...specs].sort((a, b) => a.sqlName.localeCompare(b.sqlName));
    for (const spec of lockOrder) {
      await tx.execute(sql.raw(`LOCK TABLE ${spec.sqlName} IN EXCLUSIVE MODE`));
    }

    if (mode === "wipe-and-restore") {
      // Reverse dependency order so a table is always emptied before
      // whatever it points at.
      for (const spec of [...specs].reverse()) {
        const [{ count }] = (await tx.execute(sql`select count(*)::int as count from ${spec.table}`)).rows as Array<{ count: number }>;
        wipedFirst[spec.key] = count;
        await tx.execute(sql`delete from ${spec.table}`);
      }
      logger.info({ wipedFirst }, "[full-backup] wipe complete, starting inserts");
    }

    for (const spec of specs) {
      const notNullColumns = notNullFkColumns(spec);
      let droppedForDanglingRequiredRef = 0;
      const rows = (file.data[spec.key] ?? []).flatMap((row) => {
        const sanitized = sanitizeRow(spec.key, row as Record<string, unknown>, idsBySpec, notNullColumns);
        if (sanitized === null) { droppedForDanglingRequiredRef++; return []; }
        return [convertTimestamps(spec.key, sanitized)];
      });
      if (droppedForDanglingRequiredRef > 0) {
        logger.warn(
          { table: spec.key, dropped: droppedForDanglingRequiredRef },
          "[full-backup] dropped row(s) with a dangling required reference (see validate warnings) — could not restore without violating a not-null constraint",
        );
      }
      if (rows.length === 0) continue;
      const tableStarted = Date.now();
      const totalBatches = Math.ceil(rows.length / INSERT_BATCH_SIZE);
      let created = 0;
      for (let i = 0; i < rows.length; i += INSERT_BATCH_SIZE) {
        const batch = rows.slice(i, i + INSERT_BATCH_SIZE);
        if (!batch.length) continue;
        const batchStarted = Date.now();
        await tx.insert(spec.table).values(batch as never[]);
        created += batch.length;
        // Per-batch, not just per-table: on a large table (mcqs, flashcards,
        // practiceAnswers) the old per-table-only log left a multi-minute gap
        // with no line at all, which is indistinguishable from a genuine hang
        // from the terminal. This makes a stall visible exactly at the batch
        // it stopped on, instead of only after the whole table would have
        // finished.
        logger.info(
          { table: spec.key, batch: Math.floor(i / INSERT_BATCH_SIZE) + 1, of: totalBatches, rows: created, total: rows.length, ms: Date.now() - batchStarted },
          "[full-backup] batch inserted",
        );
      }
      restored[spec.key] = created;
      logger.info({ table: spec.key, rows: created, ms: Date.now() - tableStarted }, "[full-backup] table restored");
    }

    await client.query("COMMIT");
    // Healthy commit → release with no error, so this connection returns to
    // the pool's idle list and can be reused normally.
    release();
  } catch (err) {
    // Best-effort ROLLBACK. If the connection itself is what died (the
    // exact failure mode this whole rewrite targets), this ROLLBACK will
    // itself throw — that's expected and fine, it's swallowed here because
    // the outer release(err) below is what actually matters at that point.
    try {
      await client.query("ROLLBACK");
    } catch (rollbackErr) {
      logger.warn({ err: rollbackErr }, "[full-backup] ROLLBACK itself failed — connection is likely already dead, discarding it");
    }
    // The critical line: pass the real error to release() so node-postgres
    // destroys this client instead of returning a possibly-broken
    // connection to the pool for some unrelated future request to draw.
    release(err);
    logger.error({ err, ms: Date.now() - restoreStarted }, "[full-backup] transaction rolled back — restore failed, no rows committed");
    throw err;
  }
  logger.info({ ms: Date.now() - restoreStarted }, "[full-backup] transaction committed, resyncing sequences");

  // Sequence resync happens outside the transaction (setval isn't
  // transactional in any way that matters here, and doing it after commit
  // means it always reflects what's actually on disk).
  for (const spec of specs) {
    await resyncSerialSequence(spec);
  }
  logger.info({ ms: Date.now() - restoreStarted }, "[full-backup] restore complete");

  return { scope: file.scope, mode, restored, wipedFirst };
}
