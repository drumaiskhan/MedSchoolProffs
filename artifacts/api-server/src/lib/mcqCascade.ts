import { inArray } from "drizzle-orm";
import {
  db, mcqsTable, practiceAnswersTable, examQuestionsTable, examAnswersTable,
  notebookEntriesTable, flaggedMcqsTable,
} from "@workspace/db";

// Hard-deletes a set of MCQs and every row anywhere else in the app that
// points at them (practice history, exam question lists, exam answer
// history, notebook entries, flags), so a deleted past paper or exam
// doesn't leave its questions sitting untagged in the question bank or
// dangling references in students' history. Order matters: dependents
// first, then the MCQs themselves.
//
// `exec` lets a caller that is already inside its own transaction (the
// structure-aware backup restore) run the deletes on that same connection so
// they roll back together with the rest of the restore. Defaults to the
// shared pool, which is what every other caller wants.
export async function deleteMcqsEverywhere(mcqIds: number[], exec: Pick<typeof db, "delete"> = db): Promise<void> {
  // Postgres caps one statement at 65,535 bound parameters; a year/program
  // replace can touch tens of thousands of ids, so go in slices.
  const CHUNK = 20_000;
  for (let i = 0; i < mcqIds.length; i += CHUNK) {
    const ids = mcqIds.slice(i, i + CHUNK);
    await exec.delete(practiceAnswersTable).where(inArray(practiceAnswersTable.mcqId, ids));
    await exec.delete(examAnswersTable).where(inArray(examAnswersTable.mcqId, ids));
    await exec.delete(examQuestionsTable).where(inArray(examQuestionsTable.mcqId, ids));
    await exec.delete(notebookEntriesTable).where(inArray(notebookEntriesTable.mcqId, ids));
    await exec.delete(flaggedMcqsTable).where(inArray(flaggedMcqsTable.mcqId, ids));
    await exec.delete(mcqsTable).where(inArray(mcqsTable.id, ids));
  }
}
