// Integration test for the structure-aware MCQ backup (export scoping, merge/append/replace,
// cross-database id remapping, rollback). Needs a throwaway Postgres:
//   DATABASE_URL=postgres://... ./node_modules/.bin/esbuild test/mcq-backup.integration.ts --bundle \
//     --platform=node --format=esm --outfile=./__t.mjs --external:pino --external:pino-pretty \
//     --banner:js="import { createRequire } from 'module'; const require = createRequire(import.meta.url);" \
//   && NODE_ENV=production node ./__t.mjs
// It TRUNCATES the curriculum + question tables — never point it at real data.
import assert from "node:assert/strict";
import { db, pool, ensureSchema, blocksTable, modulesTable, subjectsTable, topicsTable, mcqsTable, pastPapersTable, examsTable, examQuestionsTable } from "@workspace/db";
import { sql, eq } from "drizzle-orm";
import { buildMcqBackup, restoreMcqBackupWithStructure, McqBackupFileSchema } from "../src/lib/mcqBackup";

const counts = async () => ({
  blocks: (await db.select().from(blocksTable)).length, modules: (await db.select().from(modulesTable)).length,
  subjects: (await db.select().from(subjectsTable)).length, topics: (await db.select().from(topicsTable)).length,
  mcqs: (await db.select().from(mcqsTable)).length, papers: (await db.select().from(pastPapersTable)).length,
  exams: (await db.select().from(examsTable)).length, eq: (await db.select().from(examQuestionsTable)).length,
});
async function wipe() {
  await pool.query("TRUNCATE med_exam_questions, med_mcqs, med_topics, med_subjects, med_modules, med_blocks, med_past_papers, med_exams RESTART IDENTITY CASCADE");
}
const q = (question: string, extra: Record<string, unknown> = {}) => ({ question, options: ["a", "b", "c"], correctAnswer: "a", ...extra }) as typeof mcqsTable.$inferInsert;

async function seed() {
  const [bA_m1, bA_b1, bB_m2] = await db.insert(blocksTable).values([
    { name: "Block A", programTargetKind: "MBBS", yearTargetNumber: 1 },
    { name: "Block A", programTargetKind: "BDS", yearTargetNumber: 1 },
    { name: "Block B", programTargetKind: "MBBS", yearTargetNumber: 2 },
  ]).returning();
  const [modAnat, modBdsAnat, modY2, modShared] = await db.insert(modulesTable).values([
    { name: "Anatomy", subtitle: "", blockId: bA_m1!.id },
    { name: "Anatomy", subtitle: "", blockId: bA_b1!.id },
    { name: "Physiology", subtitle: "", blockId: bB_m2!.id },
    { name: "Ethics", subtitle: "", blockId: null },            // shared, no block, no targeting
  ]).returning();
  const [sHead, sBds, sY2] = await db.insert(subjectsTable).values([
    { moduleId: modAnat!.id, name: "Head" }, { moduleId: modBdsAnat!.id, name: "Head" }, { moduleId: modY2!.id, name: "Nerve" },
  ]).returning();
  const [tSkull, tEmpty, tBds, tY2] = await db.insert(topicsTable).values([
    { subjectId: sHead!.id, name: "Skull" }, { subjectId: sHead!.id, name: "EmptyTopic" }, { subjectId: sBds!.id, name: "Teeth" }, { subjectId: sY2!.id, name: "Action potential" },
  ]).returning();
  const [paper, paperY2] = await db.insert(pastPapersTable).values([
    { title: "KMU 2024", examBoard: "KMU", year: "2024", level: "1st Year MBBS", programTargetKind: "MBBS", yearTargetNumber: 1 },
    { title: "KMU Y2", examBoard: "KMU", year: "2024", level: "2nd Year MBBS", programTargetKind: "MBBS", yearTargetNumber: 2 },
  ]).returning();
  const [exam] = await db.insert(examsTable).values([
    { title: "Pre-prof Y1", programTargetKind: "MBBS", yearTargetNumber: 1, startAt: new Date("2026-11-01T10:00:00Z"), endAt: new Date("2026-11-01T12:00:00Z"), status: "published" },
  ]).returning();
  const mcqs = await db.insert(mcqsTable).values([
    q("Which bone is the skull base?", { moduleId: modAnat!.id, subjectId: sHead!.id, topicId: tSkull!.id }),
    q("Direct module-only question", { moduleId: modAnat!.id }),
    q("BDS tooth question", { moduleId: modBdsAnat!.id, subjectId: sBds!.id, topicId: tBds!.id }),
    q("Y2 AP question", { moduleId: modY2!.id, subjectId: sY2!.id, topicId: tY2!.id }),
    q("Past paper Q (no module)", { pastPaperId: paper!.id }),
    q("Past paper Y2 Q", { pastPaperId: paperY2!.id }),
    q("Exam question", { examId: exam!.id }),
  ]).returning();
  await db.insert(examQuestionsTable).values([{ examId: exam!.id, mcqId: mcqs[6]!.id, displayOrder: 1 }]);
  return { mcqs };
}

async function main() {
  await ensureSchema();
  await wipe();
  await seed();
  console.log("seeded", await counts());

  // ---------- 1. export scoping: MBBS year 1 ----------
  const mbbs1 = await buildMcqBackup({ level: "year", id: 1, label: "MBBS · Year 1", program: "MBBS" });
  const names = (xs: { name?: string; title?: string }[]) => xs.map((x) => x.name ?? x.title).sort();
  console.log("MBBS Y1 questions:", mbbs1.mcqs.map((m) => m.question).sort());
  assert.deepEqual(mbbs1.mcqs.map((m) => m.question).sort(), ["Direct module-only question", "Exam question", "Past paper Q (no module)", "Which bone is the skull base?"]);
  assert.deepEqual(names(mbbs1.structure!.blocks), ["Block A"]);                         // not BDS Block A, not Block B
  assert.equal(mbbs1.structure!.blocks.length, 1);
  assert.deepEqual(names(mbbs1.structure!.modules), ["Anatomy"]);
  assert.deepEqual(names(mbbs1.structure!.topics), ["EmptyTopic", "Skull"]);              // empty topic kept = whole structure
  assert.deepEqual(names(mbbs1.structure!.pastPapers), ["KMU 2024"]);
  assert.deepEqual(names(mbbs1.structure!.exams), ["Pre-prof Y1"]);
  assert.equal(mbbs1.structure!.examQuestions.length, 1);
  assert.equal(mbbs1.coverage!.moduleIds.length, 1);

  const bds1 = await buildMcqBackup({ level: "year", id: 1, label: "BDS · Year 1", program: "BDS" });
  assert.deepEqual(bds1.mcqs.map((m) => m.question), ["BDS tooth question"]);
  const anyY1 = await buildMcqBackup({ level: "year", id: 1, label: "Year 1" });         // no program filter = both
  assert.equal(anyY1.mcqs.length, 5);
  const shared = await buildMcqBackup({ level: "program", id: 0, label: "Shared", program: "SHARED" });
  assert.deepEqual(names(shared.structure!.modules), ["Ethics"]);
  const allMbbs = await buildMcqBackup({ level: "program", id: 0, label: "MBBS", program: "MBBS" });
  assert.equal(allMbbs.mcqs.length, 6);                                                  // all MBBS: Y1(4)+Y2(AP + paper Y2)
  console.log("export scoping OK");

  // ---------- 2. JSON round trip + schema ----------
  const file1 = McqBackupFileSchema.parse(JSON.parse(JSON.stringify(mbbs1)));

  // ---------- 3. restore into the SAME db: merge must be a no-op ----------
  const before = await counts();
  const dry = await restoreMcqBackupWithStructure(file1, "merge", { dryRun: true });
  assert.equal(dry.questions.restored, 0); assert.equal(dry.questions.skippedExisting, 4);
  assert.deepEqual(await counts(), before);                                              // dry run wrote nothing
  const merged = await restoreMcqBackupWithStructure(file1, "merge");
  assert.equal(merged.questions.restored, 0);
  assert.equal(merged.structure.topics.created, 0);
  assert.deepEqual(await counts(), before);
  console.log("same-db merge no-op OK");

  // ---------- 4. append duplicates questions, not structure ----------
  const appended = await restoreMcqBackupWithStructure(file1, "append");
  assert.equal(appended.questions.restored, 4);
  const c4 = await counts(); assert.equal(c4.mcqs, before.mcqs + 4); assert.equal(c4.topics, before.topics); assert.equal(c4.blocks, before.blocks);
  assert.equal(c4.eq, before.eq + 1);                                                    // the appended COPY of the exam question joins the exam too
  // ---------- 5. replace wipes only the scope, then restores ----------
  const replaced = await restoreMcqBackupWithStructure(file1, "replace");
  assert.equal(replaced.deletedFirst, 8);                                                // 4 original + 4 appended copies, all MBBS Y1
  const c5 = await counts(); assert.equal(c5.mcqs, before.mcqs);                         // others (BDS, Y2, Y2 paper) untouched
  const survivors = (await db.select().from(mcqsTable)).map((m) => m.question);
  assert.ok(survivors.includes("BDS tooth question") && survivors.includes("Y2 AP question") && survivors.includes("Past paper Y2 Q"));
  const examLink = await db.select().from(examQuestionsTable); assert.equal(examLink.length, 1);
  console.log("append / replace OK");

  // ---------- 6. restore into a DB with DIFFERENT ids (the real "other environment" case) ----------
  await wipe();
  // burn ids and create unrelated structure so nothing lines up
  await db.insert(blocksTable).values([{ name: "Unrelated 1" }, { name: "Unrelated 2" }, { name: "Unrelated 3" }]);
  await db.insert(modulesTable).values([{ name: "Zzz", subtitle: "" }]);
  const [fillerSubj] = await db.insert(subjectsTable).values([{ moduleId: 1, name: "Filler" }]).returning();
  await db.insert(topicsTable).values([{ subjectId: fillerSubj!.id, name: "Filler topic" }]);
  await db.insert(mcqsTable).values([q("filler"), q("filler 2"), q("filler 3")]);
  const base = await counts();
  const restored = await restoreMcqBackupWithStructure(file1, "merge");
  console.log("cross-env summary:", JSON.stringify(restored.structure), JSON.stringify(restored.questions), restored.warnings);
  assert.equal(restored.questions.restored, 4);
  assert.equal(restored.structure.blocks.created, 1); assert.equal(restored.structure.topics.created, 2);
  assert.equal(restored.structure.exams.created, 1); assert.equal(restored.examLinks, 1);
  const c6 = await counts();
  assert.equal(c6.mcqs, base.mcqs + 4); assert.equal(c6.blocks, base.blocks + 1); assert.equal(c6.eq, 1);
  // placements must be remapped to the NEW ids and still point at the right names
  const sk = (await db.select().from(mcqsTable).where(eq(mcqsTable.question, "Which bone is the skull base?")))[0]!;
  const skTopic = (await db.select().from(topicsTable).where(eq(topicsTable.id, sk.topicId!)))[0]!;
  const skSubj = (await db.select().from(subjectsTable).where(eq(subjectsTable.id, sk.subjectId!)))[0]!;
  const skMod = (await db.select().from(modulesTable).where(eq(modulesTable.id, sk.moduleId!)))[0]!;
  const skBlock = (await db.select().from(blocksTable).where(eq(blocksTable.id, skMod.blockId!)))[0]!;
  assert.deepEqual([skTopic.name, skSubj.name, skMod.name, skBlock.name, skBlock.programTargetKind, skBlock.yearTargetNumber], ["Skull", "Head", "Anatomy", "Block A", "MBBS", 1]);
  assert.equal(skTopic.subjectId, skSubj.id); assert.equal(skSubj.moduleId, skMod.id);
  const ppq = (await db.select().from(mcqsTable).where(eq(mcqsTable.question, "Past paper Q (no module)")))[0]!;
  const pp = (await db.select().from(pastPapersTable).where(eq(pastPapersTable.id, ppq.pastPaperId!)))[0]!;
  assert.equal(pp.title, "KMU 2024");
  const exq = (await db.select().from(mcqsTable).where(eq(mcqsTable.question, "Exam question")))[0]!;
  const ex = (await db.select().from(examsTable).where(eq(examsTable.id, exq.examId!)))[0]!;
  assert.equal(ex.title, "Pre-prof Y1"); assert.equal(ex.status, "draft");               // restored exams never auto-publish
  const link = (await db.select().from(examQuestionsTable))[0]!; assert.deepEqual([link.examId, link.mcqId], [ex.id, exq.id]);
  // restoring twice into the new DB stays idempotent
  const again = await restoreMcqBackupWithStructure(file1, "merge");
  assert.equal(again.questions.restored, 0); assert.equal((await counts()).mcqs, base.mcqs + 4);
  console.log("cross-environment remap OK");

  // ---------- 7. atomicity: a failure mid-restore leaves NOTHING behind ----------
  const badFile = JSON.parse(JSON.stringify(file1));
  badFile.structure.blocks.push({ id: 9001, name: "Will be rolled back", programTargetKind: "MBBS", yearTargetNumber: 4 });
  badFile.structure.exams[0].title = "Different exam";            // force a new exam insert...
  badFile.structure.exams[0].startAt = "not a date";               // ...that blows up
  const snapshot = await counts();
  await assert.rejects(() => restoreMcqBackupWithStructure(McqBackupFileSchema.parse(badFile), "merge"));
  assert.deepEqual(await counts(), snapshot);
  const leaked = await db.select().from(blocksTable).where(eq(blocksTable.name, "Will be rolled back"));
  assert.equal(leaked.length, 0);
  // and the pool still works afterwards (connection was released properly)
  assert.equal((await pool.query("select 1 as ok")).rows[0].ok, 1);
  console.log("rollback OK");

  // ---------- 8. v1 files still parse (no structure) ----------
  const v1 = McqBackupFileSchema.parse({ formatVersion: 1, mcqs: [{ question: "old", options: ["a", "b"] }] });
  assert.equal(v1.structure, undefined);

  // ---------- 9. replace of a scoped file without coverage refuses instead of guessing ----------
  const noCov = McqBackupFileSchema.parse({ ...JSON.parse(JSON.stringify(file1)), coverage: undefined });
  await assert.rejects(() => restoreMcqBackupWithStructure(noCov, "replace"), /coverage/);
  console.log("ALL PASSED");
  await pool.end();
}
main().catch(async (e) => { console.error("FAILED", e); await pool.end().catch(() => {}); process.exit(1); });
