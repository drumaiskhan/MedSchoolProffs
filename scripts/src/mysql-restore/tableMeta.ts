// AUTO-DERIVED from lib/db/src/schema/medschool.ts — column names/types for every
// table the whole-database backup covers (see CONTENT_TABLES/USER_TABLES/FK_CHECKS
// in artifacts/api-server/src/lib/fullBackup.ts, which this mirrors). Regenerate by
// re-running the extraction if the Postgres schema changes columns/tables.
//
// Deliberately NOT imported from @workspace/db: that package opens a real Postgres
// connection as an import side effect (see lib/db/src/index.ts), which would make
// this MySQL-only tool require DATABASE_URL/Postgres just to load. This module is
// plain data with no database dependency at all.

export type ColumnType = "int" | "text" | "boolean" | "timestamp" | "date" | "numeric" | "json";

export interface ColumnMeta {
  /** JS property name — matches the key in a backup JSON row. */
  js: string;
  /** Column name in the (Postgres today, MySQL in future) table. */
  sql: string;
  type: ColumnType;
  /** Postgres text[]/integer[] — stored as a MySQL JSON array instead (see convert.ts). */
  array?: boolean;
}

export interface MysqlTableSpec {
  key: string;
  sqlName: string;
  columns: ColumnMeta[];
  primaryKey: string[];
}

const institutionsSpec: MysqlTableSpec = {
  key: "institutions",
  sqlName: "med_institutions",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "city", sql: "city", type: "text" },
    { js: "kind", sql: "kind", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const programsSpec: MysqlTableSpec = {
  key: "programs",
  sqlName: "med_programs",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "institutionId", sql: "institution_id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "kind", sql: "kind", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const academicYearsSpec: MysqlTableSpec = {
  key: "academicYears",
  sqlName: "med_academic_years",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "programId", sql: "program_id", type: "int" },
    { js: "label", sql: "label", type: "text" },
    { js: "yearNumber", sql: "year_number", type: "int" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const batchesSpec: MysqlTableSpec = {
  key: "batches",
  sqlName: "med_batches",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "academicYearId", sql: "academic_year_id", type: "int" },
    { js: "label", sql: "label", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const blocksSpec: MysqlTableSpec = {
  key: "blocks",
  sqlName: "med_blocks",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "subtitle", sql: "subtitle", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "iconPath", sql: "icon_path", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const modulesSpec: MysqlTableSpec = {
  key: "modules",
  sqlName: "med_modules",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "subtitle", sql: "subtitle", type: "text" },
    { js: "blockId", sql: "block_id", type: "int" },
    { js: "iconPath", sql: "icon_path", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const subjectsSpec: MysqlTableSpec = {
  key: "subjects",
  sqlName: "med_subjects",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "iconPath", sql: "icon_path", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const topicsSpec: MysqlTableSpec = {
  key: "topics",
  sqlName: "med_topics",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const pastPapersSpec: MysqlTableSpec = {
  key: "pastPapers",
  sqlName: "med_past_papers",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "examBoard", sql: "exam_board", type: "text" },
    { js: "year", sql: "year", type: "text" },
    { js: "level", sql: "level", type: "text" },
    { js: "institutionId", sql: "institution_id", type: "int" },
    { js: "programId", sql: "program_id", type: "int" },
    { js: "academicYearId", sql: "academic_year_id", type: "int" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const examsSpec: MysqlTableSpec = {
  key: "exams",
  sqlName: "med_exams",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "description", sql: "description", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "durationMinutes", sql: "duration_minutes", type: "int" },
    { js: "startAt", sql: "start_at", type: "timestamp" },
    { js: "endAt", sql: "end_at", type: "timestamp" },
    { js: "maxAttempts", sql: "max_attempts", type: "int" },
    { js: "negativeMarkingEnabled", sql: "negative_marking_enabled", type: "boolean" },
    { js: "negativeMarkPerWrong", sql: "negative_mark_per_wrong", type: "numeric" },
    { js: "passingPercent", sql: "passing_percent", type: "numeric" },
    { js: "resultReleaseMode", sql: "result_release_mode", type: "text" },
    { js: "showMarks", sql: "show_marks", type: "boolean" },
    { js: "showPercentage", sql: "show_percentage", type: "boolean" },
    { js: "showCorrectAnswers", sql: "show_correct_answers", type: "boolean" },
    { js: "status", sql: "status", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const mcqsSpec: MysqlTableSpec = {
  key: "mcqs",
  sqlName: "med_mcqs",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "question", sql: "question", type: "text" },
    { js: "options", sql: "options", type: "text", array: true },
    { js: "correctAnswer", sql: "correct_answer", type: "text" },
    { js: "explanation", sql: "explanation", type: "text" },
    { js: "optionExplanations", sql: "option_explanations", type: "text", array: true },
    { js: "hint", sql: "hint", type: "text" },
    { js: "explanationStatus", sql: "explanation_status", type: "text" },
    { js: "reference", sql: "reference", type: "text" },
    { js: "difficulty", sql: "difficulty", type: "text" },
    { js: "tags", sql: "tags", type: "text", array: true },
    { js: "imagePath", sql: "image_path", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "source", sql: "source", type: "text" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "topicId", sql: "topic_id", type: "int" },
    { js: "pastPaperId", sql: "past_paper_id", type: "int" },
    { js: "examId", sql: "exam_id", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const examQuestionsSpec: MysqlTableSpec = {
  key: "examQuestions",
  sqlName: "med_exam_questions",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "examId", sql: "exam_id", type: "int" },
    { js: "mcqId", sql: "mcq_id", type: "int" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const flashcardsSpec: MysqlTableSpec = {
  key: "flashcards",
  sqlName: "med_flashcards",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "front", sql: "front", type: "text" },
    { js: "back", sql: "back", type: "text" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "topicId", sql: "topic_id", type: "int" },
    { js: "module", sql: "module", type: "text" },
    { js: "topic", sql: "topic", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const resourcesSpec: MysqlTableSpec = {
  key: "resources",
  sqlName: "med_resources",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "description", sql: "description", type: "text" },
    { js: "kind", sql: "kind", type: "text" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "institutionId", sql: "institution_id", type: "int" },
    { js: "programId", sql: "program_id", type: "int" },
    { js: "academicYearId", sql: "academic_year_id", type: "int" },
    { js: "module", sql: "module", type: "text" },
    { js: "size", sql: "size", type: "text" },
    { js: "storagePath", sql: "storage_path", type: "text" },
    { js: "externalUrl", sql: "external_url", type: "text" },
    { js: "protected", sql: "protected", type: "boolean" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const booksSpec: MysqlTableSpec = {
  key: "books",
  sqlName: "med_books",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "author", sql: "author", type: "text" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "topicId", sql: "topic_id", type: "int" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "storagePath", sql: "storage_path", type: "text" },
    { js: "coverImagePath", sql: "cover_image_path", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "isFree", sql: "is_free", type: "boolean" },
    { js: "price", sql: "price", type: "numeric" },
    { js: "currency", sql: "currency", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const teamMembersSpec: MysqlTableSpec = {
  key: "teamMembers",
  sqlName: "med_team_members",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "role", sql: "role", type: "text" },
    { js: "category", sql: "category", type: "text" },
    { js: "bio", sql: "bio", type: "text" },
    { js: "achievementBadge", sql: "achievement_badge", type: "text" },
    { js: "photoPath", sql: "photo_path", type: "text" },
    { js: "linkedinUrl", sql: "linkedin_url", type: "text" },
    { js: "instagramUrl", sql: "instagram_url", type: "text" },
    { js: "email", sql: "email", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const membershipPlansSpec: MysqlTableSpec = {
  key: "membershipPlans",
  sqlName: "med_membership_plans",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "description", sql: "description", type: "text" },
    { js: "price", sql: "price", type: "numeric" },
    { js: "currency", sql: "currency", type: "text" },
    { js: "duration", sql: "duration", type: "int" },
    { js: "durationUnit", sql: "duration_unit", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "autoRenew", sql: "auto_renew", type: "boolean" },
    { js: "eligibility", sql: "eligibility", type: "text" },
    { js: "originalPrice", sql: "original_price", type: "numeric" },
    { js: "discountLabel", sql: "discount_label", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const couponsSpec: MysqlTableSpec = {
  key: "coupons",
  sqlName: "med_coupons",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "code", sql: "code", type: "text" },
    { js: "discountType", sql: "discount_type", type: "text" },
    { js: "discountValue", sql: "discount_value", type: "numeric" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "maxUses", sql: "max_uses", type: "int" },
    { js: "usedCount", sql: "used_count", type: "int" },
    { js: "expiresAt", sql: "expires_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeBlocksSpec: MysqlTableSpec = {
  key: "ospeBlocks",
  sqlName: "med_ospe_blocks",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "subtitle", sql: "subtitle", type: "text" },
    { js: "examType", sql: "exam_type", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "iconPath", sql: "icon_path", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeModulesSpec: MysqlTableSpec = {
  key: "ospeModules",
  sqlName: "med_ospe_modules",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "blockId", sql: "block_id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "subtitle", sql: "subtitle", type: "text" },
    { js: "examType", sql: "exam_type", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "iconPath", sql: "icon_path", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeLearningMaterialsSpec: MysqlTableSpec = {
  key: "ospeLearningMaterials",
  sqlName: "med_ospe_learning_materials",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "blockId", sql: "block_id", type: "int" },
    { js: "examType", sql: "exam_type", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "description", sql: "description", type: "text" },
    { js: "bodyText", sql: "body_text", type: "text" },
    { js: "imagePath", sql: "image_path", type: "text" },
    { js: "attachmentPath", sql: "attachment_path", type: "text" },
    { js: "externalUrl", sql: "external_url", type: "text" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeStationsSpec: MysqlTableSpec = {
  key: "ospeStations",
  sqlName: "med_ospe_stations",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "blockId", sql: "block_id", type: "int" },
    { js: "examType", sql: "exam_type", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "instructions", sql: "instructions", type: "text" },
    { js: "imagePath", sql: "image_path", type: "text" },
    { js: "attachmentPath", sql: "attachment_path", type: "text" },
    { js: "answerType", sql: "answer_type", type: "text" },
    { js: "options", sql: "options", type: "text", array: true },
    { js: "correctAnswer", sql: "correct_answer", type: "text" },
    { js: "modelAnswer", sql: "model_answer", type: "text" },
    { js: "labelPoints", sql: "label_points", type: "json" },
    { js: "marks", sql: "marks", type: "numeric" },
    { js: "timeLimitSeconds", sql: "time_limit_seconds", type: "int" },
    { js: "active", sql: "active", type: "boolean" },
    { js: "archived", sql: "archived", type: "boolean" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeExamsSpec: MysqlTableSpec = {
  key: "ospeExams",
  sqlName: "med_ospe_exams",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "description", sql: "description", type: "text" },
    { js: "examType", sql: "exam_type", type: "text" },
    { js: "programTargetKind", sql: "program_target_kind", type: "text" },
    { js: "yearTargetNumber", sql: "year_target_number", type: "int" },
    { js: "durationMinutes", sql: "duration_minutes", type: "int" },
    { js: "startAt", sql: "start_at", type: "timestamp" },
    { js: "endAt", sql: "end_at", type: "timestamp" },
    { js: "maxAttempts", sql: "max_attempts", type: "int" },
    { js: "passingPercent", sql: "passing_percent", type: "numeric" },
    { js: "resultReleaseMode", sql: "result_release_mode", type: "text" },
    { js: "showMarks", sql: "show_marks", type: "boolean" },
    { js: "showPercentage", sql: "show_percentage", type: "boolean" },
    { js: "showCorrectAnswers", sql: "show_correct_answers", type: "boolean" },
    { js: "status", sql: "status", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeExamStationsSpec: MysqlTableSpec = {
  key: "ospeExamStations",
  sqlName: "med_ospe_exam_stations",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "examId", sql: "exam_id", type: "int" },
    { js: "stationId", sql: "station_id", type: "int" },
    { js: "displayOrder", sql: "display_order", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const platformSettingsSpec: MysqlTableSpec = {
  key: "platformSettings",
  sqlName: "med_platform_settings",
  primaryKey: ["key"],
  columns: [
    { js: "key", sql: "key", type: "text" },
    { js: "value", sql: "value", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const mcqImportProfilesSpec: MysqlTableSpec = {
  key: "mcqImportProfiles",
  sqlName: "med_mcq_import_profiles",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "questionPattern", sql: "question_pattern", type: "text" },
    { js: "optionPattern", sql: "option_pattern", type: "text" },
    { js: "answerPattern", sql: "answer_pattern", type: "text" },
    { js: "explanationPattern", sql: "explanation_pattern", type: "text" },
    { js: "hintPattern", sql: "hint_pattern", type: "text" },
    { js: "referencePattern", sql: "reference_pattern", type: "text" },
    { js: "isDefault", sql: "is_default", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const usersSpec: MysqlTableSpec = {
  key: "users",
  sqlName: "med_users",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "email", sql: "email", type: "text" },
    { js: "passwordHash", sql: "password_hash", type: "text" },
    { js: "role", sql: "role", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "statusMessage", sql: "status_message", type: "text" },
    { js: "emailVerified", sql: "email_verified", type: "boolean" },
    { js: "institutionId", sql: "institution_id", type: "int" },
    { js: "programId", sql: "program_id", type: "int" },
    { js: "academicYearId", sql: "academic_year_id", type: "int" },
    { js: "batchId", sql: "batch_id", type: "int" },
    { js: "rollNumber", sql: "roll_number", type: "text" },
    { js: "phone", sql: "phone", type: "text" },
    { js: "profilePicturePath", sql: "profile_picture_path", type: "text" },
    { js: "failedLoginAttempts", sql: "failed_login_attempts", type: "int" },
    { js: "lockedUntil", sql: "locked_until", type: "timestamp" },
    { js: "passwordChangedAt", sql: "password_changed_at", type: "timestamp" },
    { js: "lastLoginAt", sql: "last_login_at", type: "timestamp" },
    { js: "maxDevices", sql: "max_devices", type: "int" },
    { js: "currentStreak", sql: "current_streak", type: "int" },
    { js: "longestStreak", sql: "longest_streak", type: "int" },
    { js: "lastPracticeDate", sql: "last_practice_date", type: "date" },
    { js: "institution", sql: "institution", type: "text" },
    { js: "program", sql: "program", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const studentDocumentsSpec: MysqlTableSpec = {
  key: "studentDocuments",
  sqlName: "med_student_documents",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "label", sql: "label", type: "text" },
    { js: "storagePath", sql: "storage_path", type: "text" },
    { js: "mimeType", sql: "mime_type", type: "text" },
    { js: "sizeBytes", sql: "size_bytes", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const paymentsSpec: MysqlTableSpec = {
  key: "payments",
  sqlName: "med_payments",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "planId", sql: "plan_id", type: "int" },
    { js: "planName", sql: "plan_name", type: "text" },
    { js: "amount", sql: "amount", type: "numeric" },
    { js: "currency", sql: "currency", type: "text" },
    { js: "duration", sql: "duration", type: "int" },
    { js: "durationUnit", sql: "duration_unit", type: "text" },
    { js: "method", sql: "method", type: "text" },
    { js: "reference", sql: "reference", type: "text" },
    { js: "paymentDate", sql: "payment_date", type: "date" },
    { js: "proofPath", sql: "proof_path", type: "text" },
    { js: "proofMimeType", sql: "proof_mime_type", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "rejectionReason", sql: "rejection_reason", type: "text" },
    { js: "reviewedBy", sql: "reviewed_by", type: "int" },
    { js: "reviewedAt", sql: "reviewed_at", type: "timestamp" },
    { js: "gatewayProvider", sql: "gateway_provider", type: "text" },
    { js: "gatewayReference", sql: "gateway_reference", type: "text" },
    { js: "couponCode", sql: "coupon_code", type: "text" },
    { js: "discountAmount", sql: "discount_amount", type: "numeric" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const membershipsSpec: MysqlTableSpec = {
  key: "memberships",
  sqlName: "med_memberships",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "paymentId", sql: "payment_id", type: "int" },
    { js: "planId", sql: "plan_id", type: "int" },
    { js: "status", sql: "status", type: "text" },
    { js: "startsAt", sql: "starts_at", type: "timestamp" },
    { js: "expiresAt", sql: "expires_at", type: "timestamp" },
    { js: "suspendedReason", sql: "suspended_reason", type: "text" },
    { js: "isTrial", sql: "is_trial", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const bookPurchasesSpec: MysqlTableSpec = {
  key: "bookPurchases",
  sqlName: "med_book_purchases",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "bookId", sql: "book_id", type: "int" },
    { js: "bookTitle", sql: "book_title", type: "text" },
    { js: "amount", sql: "amount", type: "numeric" },
    { js: "currency", sql: "currency", type: "text" },
    { js: "method", sql: "method", type: "text" },
    { js: "reference", sql: "reference", type: "text" },
    { js: "paymentDate", sql: "payment_date", type: "date" },
    { js: "proofPath", sql: "proof_path", type: "text" },
    { js: "proofMimeType", sql: "proof_mime_type", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "rejectionReason", sql: "rejection_reason", type: "text" },
    { js: "reviewedBy", sql: "reviewed_by", type: "int" },
    { js: "reviewedAt", sql: "reviewed_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const practiceAttemptsSpec: MysqlTableSpec = {
  key: "practiceAttempts",
  sqlName: "med_practice_attempts",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "topicId", sql: "topic_id", type: "int" },
    { js: "mode", sql: "mode", type: "text" },
    { js: "totalQuestions", sql: "total_questions", type: "int" },
    { js: "correctCount", sql: "correct_count", type: "int" },
    { js: "scorePercent", sql: "score_percent", type: "numeric" },
    { js: "startedAt", sql: "started_at", type: "timestamp" },
    { js: "completedAt", sql: "completed_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const practiceAnswersSpec: MysqlTableSpec = {
  key: "practiceAnswers",
  sqlName: "med_practice_answers",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "attemptId", sql: "attempt_id", type: "int" },
    { js: "mcqId", sql: "mcq_id", type: "int" },
    { js: "selectedAnswer", sql: "selected_answer", type: "text" },
    { js: "correct", sql: "correct", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const studentProgressSpec: MysqlTableSpec = {
  key: "studentProgress",
  sqlName: "med_student_progress",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "topicsCompleted", sql: "topics_completed", type: "int" },
    { js: "progressPercent", sql: "progress_percent", type: "int" },
    { js: "lastActivityAt", sql: "last_activity_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const challengesSpec: MysqlTableSpec = {
  key: "challenges",
  sqlName: "med_challenges",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "challengerId", sql: "challenger_id", type: "int" },
    { js: "opponentId", sql: "opponent_id", type: "int" },
    { js: "blockId", sql: "block_id", type: "int" },
    { js: "moduleId", sql: "module_id", type: "int" },
    { js: "subjectId", sql: "subject_id", type: "int" },
    { js: "topicId", sql: "topic_id", type: "int" },
    { js: "mcqIds", sql: "mcq_ids", type: "int", array: true },
    { js: "status", sql: "status", type: "text" },
    { js: "expiresAt", sql: "expires_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const challengeAttemptsSpec: MysqlTableSpec = {
  key: "challengeAttempts",
  sqlName: "med_challenge_attempts",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "challengeId", sql: "challenge_id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "correctCount", sql: "correct_count", type: "int" },
    { js: "totalQuestions", sql: "total_questions", type: "int" },
    { js: "scorePercent", sql: "score_percent", type: "numeric" },
    { js: "durationSeconds", sql: "duration_seconds", type: "int" },
    { js: "completedAt", sql: "completed_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const notebookEntriesSpec: MysqlTableSpec = {
  key: "notebookEntries",
  sqlName: "med_notebook_entries",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "mcqId", sql: "mcq_id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "content", sql: "content", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const bookHighlightsSpec: MysqlTableSpec = {
  key: "bookHighlights",
  sqlName: "med_book_highlights",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "bookId", sql: "book_id", type: "int" },
    { js: "fileKey", sql: "file_key", type: "text" },
    { js: "page", sql: "page", type: "int" },
    { js: "kind", sql: "kind", type: "text" },
    { js: "startWord", sql: "start_word", type: "int" },
    { js: "endWord", sql: "end_word", type: "int" },
    { js: "rect", sql: "rect", type: "text" },
    { js: "color", sql: "color", type: "text" },
    { js: "note", sql: "note", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const bookReadingProgressSpec: MysqlTableSpec = {
  key: "bookReadingProgress",
  sqlName: "med_book_reading_progress",
  primaryKey: ["userId", "bookId"],
  columns: [
    { js: "userId", sql: "user_id", type: "int" },
    { js: "bookId", sql: "book_id", type: "int" },
    { js: "page", sql: "page", type: "int" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const savedSessionsSpec: MysqlTableSpec = {
  key: "savedSessions",
  sqlName: "med_saved_sessions",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "name", sql: "name", type: "text" },
    { js: "config", sql: "config", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const flaggedMcqsSpec: MysqlTableSpec = {
  key: "flaggedMcqs",
  sqlName: "med_flagged_mcqs",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "mcqId", sql: "mcq_id", type: "int" },
    { js: "reason", sql: "reason", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const feedbackSpec: MysqlTableSpec = {
  key: "feedback",
  sqlName: "med_feedback",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "category", sql: "category", type: "text" },
    { js: "message", sql: "message", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "rating", sql: "rating", type: "int" },
    { js: "featured", sql: "featured", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const feedbackRepliesSpec: MysqlTableSpec = {
  key: "feedbackReplies",
  sqlName: "med_feedback_replies",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "feedbackId", sql: "feedback_id", type: "int" },
    { js: "authorId", sql: "author_id", type: "int" },
    { js: "authorRole", sql: "author_role", type: "text" },
    { js: "message", sql: "message", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const notificationsSpec: MysqlTableSpec = {
  key: "notifications",
  sqlName: "med_notifications",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "title", sql: "title", type: "text" },
    { js: "body", sql: "body", type: "text" },
    { js: "type", sql: "type", type: "text" },
    { js: "read", sql: "read", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const notificationDismissalsSpec: MysqlTableSpec = {
  key: "notificationDismissals",
  sqlName: "med_notification_dismissals",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "notificationId", sql: "notification_id", type: "int" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const examAttemptsSpec: MysqlTableSpec = {
  key: "examAttempts",
  sqlName: "med_exam_attempts",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "examId", sql: "exam_id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "attemptNumber", sql: "attempt_number", type: "int" },
    { js: "startedAt", sql: "started_at", type: "timestamp" },
    { js: "submittedAt", sql: "submitted_at", type: "timestamp" },
    { js: "totalQuestions", sql: "total_questions", type: "int" },
    { js: "correctCount", sql: "correct_count", type: "int" },
    { js: "wrongCount", sql: "wrong_count", type: "int" },
    { js: "unansweredCount", sql: "unanswered_count", type: "int" },
    { js: "score", sql: "score", type: "numeric" },
    { js: "percentage", sql: "percentage", type: "numeric" },
    { js: "passed", sql: "passed", type: "boolean" },
    { js: "status", sql: "status", type: "text" },
    { js: "resultsReleasedAt", sql: "results_released_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const examAnswersSpec: MysqlTableSpec = {
  key: "examAnswers",
  sqlName: "med_exam_answers",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "attemptId", sql: "attempt_id", type: "int" },
    { js: "mcqId", sql: "mcq_id", type: "int" },
    { js: "selectedAnswer", sql: "selected_answer", type: "text" },
    { js: "correct", sql: "correct", type: "boolean" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeExamAttemptsSpec: MysqlTableSpec = {
  key: "ospeExamAttempts",
  sqlName: "med_ospe_exam_attempts",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "examId", sql: "exam_id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "attemptNumber", sql: "attempt_number", type: "int" },
    { js: "startedAt", sql: "started_at", type: "timestamp" },
    { js: "submittedAt", sql: "submitted_at", type: "timestamp" },
    { js: "totalStations", sql: "total_stations", type: "int" },
    { js: "totalMarks", sql: "total_marks", type: "numeric" },
    { js: "obtainedMarks", sql: "obtained_marks", type: "numeric" },
    { js: "percentage", sql: "percentage", type: "numeric" },
    { js: "passed", sql: "passed", type: "boolean" },
    { js: "status", sql: "status", type: "text" },
    { js: "resultsReleasedAt", sql: "results_released_at", type: "timestamp" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const ospeExamAnswersSpec: MysqlTableSpec = {
  key: "ospeExamAnswers",
  sqlName: "med_ospe_exam_answers",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "attemptId", sql: "attempt_id", type: "int" },
    { js: "stationId", sql: "station_id", type: "int" },
    { js: "selectedAnswer", sql: "selected_answer", type: "text" },
    { js: "writtenAnswer", sql: "written_answer", type: "text" },
    { js: "labelAnswers", sql: "label_answers", type: "json" },
    { js: "correct", sql: "correct", type: "boolean" },
    { js: "aiVerdict", sql: "ai_verdict", type: "text" },
    { js: "aiFeedback", sql: "ai_feedback", type: "text" },
    { js: "aiGradedAt", sql: "ai_graded_at", type: "timestamp" },
    { js: "marksObtained", sql: "marks_obtained", type: "numeric" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

const aiVisualizerLogsSpec: MysqlTableSpec = {
  key: "aiVisualizerLogs",
  sqlName: "med_ai_visualizer_logs",
  primaryKey: ["id"],
  columns: [
    { js: "id", sql: "id", type: "int" },
    { js: "userId", sql: "user_id", type: "int" },
    { js: "prompt", sql: "prompt", type: "text" },
    { js: "status", sql: "status", type: "text" },
    { js: "visualizationType", sql: "visualization_type", type: "text" },
    { js: "errorMessage", sql: "error_message", type: "text" },
    { js: "rawResponse", sql: "raw_response", type: "text" },
    { js: "createdAt", sql: "created_at", type: "timestamp" },
    { js: "updatedAt", sql: "updated_at", type: "timestamp" },
  ],
};

// Same order as CONTENT_TABLES in fullBackup.ts — a row is never inserted before
// something it points at via a foreign key.
export const CONTENT_TABLE_SPECS: MysqlTableSpec[] = [
  institutionsSpec,
  programsSpec,
  academicYearsSpec,
  batchesSpec,
  blocksSpec,
  modulesSpec,
  subjectsSpec,
  topicsSpec,
  pastPapersSpec,
  examsSpec,
  mcqsSpec,
  examQuestionsSpec,
  flashcardsSpec,
  resourcesSpec,
  booksSpec,
  teamMembersSpec,
  membershipPlansSpec,
  couponsSpec,
  ospeBlocksSpec,
  ospeModulesSpec,
  ospeLearningMaterialsSpec,
  ospeStationsSpec,
  ospeExamsSpec,
  ospeExamStationsSpec,
  platformSettingsSpec,
  mcqImportProfilesSpec,
];

// Same order as USER_TABLES in fullBackup.ts.
export const USER_TABLE_SPECS: MysqlTableSpec[] = [
  usersSpec,
  studentDocumentsSpec,
  paymentsSpec,
  membershipsSpec,
  bookPurchasesSpec,
  practiceAttemptsSpec,
  practiceAnswersSpec,
  studentProgressSpec,
  challengesSpec,
  challengeAttemptsSpec,
  notebookEntriesSpec,
  bookHighlightsSpec,
  bookReadingProgressSpec,
  savedSessionsSpec,
  flaggedMcqsSpec,
  feedbackSpec,
  feedbackRepliesSpec,
  notificationsSpec,
  notificationDismissalsSpec,
  examAttemptsSpec,
  examAnswersSpec,
  ospeExamAttemptsSpec,
  ospeExamAnswersSpec,
  aiVisualizerLogsSpec,
];

export type BackupScopeName = "content" | "users" | "full";

// Same order as ALL_TABLES in fullBackup.ts.
export const ALL_TABLE_SPECS: MysqlTableSpec[] = [...CONTENT_TABLE_SPECS, ...USER_TABLE_SPECS];

export function specsFor(scope: BackupScopeName): MysqlTableSpec[] {
  if (scope === "content") return CONTENT_TABLE_SPECS;
  if (scope === "users") return USER_TABLE_SPECS;
  return ALL_TABLE_SPECS;
}

// Tables with no auto-increment `id` to resync after a bulk insert with explicit
// ids — platformSettings is keyed by its text `key`; bookReadingProgress by the
// (userId, bookId) composite pk. Mirrors NO_SERIAL_ID in fullBackup.ts, plus
// bookReadingProgress which that set currently omits (harmless there only because
// nothing has yet forced a Postgres restore of that specific table into the code
// path that calls pg_get_serial_sequence on a non-existent `id` column).
export const NO_AUTO_INCREMENT = new Set(["platformSettings", "bookReadingProgress"]);

// Verbatim copy of FK_CHECKS from fullBackup.ts — keep the two in sync if the
// Postgres schema's foreign keys change.
export const FK_CHECKS: Record<string, Array<[string, string]>> = {
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
