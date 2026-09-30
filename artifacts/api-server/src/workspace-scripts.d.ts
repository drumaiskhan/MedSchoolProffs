// Type shim: `@workspace/scripts` is bundled by esbuild (build.mjs resolves it)
// but is not listed in this package's dependencies, so tsc can't find it.
// Adding it as a dependency would change pnpm-lock.yaml and break
// `--frozen-lockfile` deploys, so the surface api-server uses is declared here.
// Keep in step with scripts/src/mysql-restore/restore.ts.
declare module "@workspace/scripts/mysql-restore/restore" {
  export class MysqlTargetHasDataError extends Error {
    readonly anchorTable: string;
    constructor(anchorTable: string);
  }
  export function testMysqlConnection(url: string): Promise<{ ok: true } | { ok: false; error: string }>;
  export function validateForMysql(
    raw: unknown,
    url?: string,
  ): Promise<{ valid: boolean; scope?: string; targetHasExistingData: boolean; [key: string]: unknown }>;
  export function restoreToMysql(
    raw: unknown,
    url: string,
    mode: "restore-empty" | "wipe-and-restore",
  ): Promise<{ scope: string; mode: string; restored: unknown; [key: string]: unknown }>;
}

// pdf-parse ships no types for its inner entry point (used to skip the
// debug block in pdf-parse/index.js).
declare module "pdf-parse/lib/pdf-parse.js" {
  const pdfParse: (data: Buffer) => Promise<{ text: string; numpages: number; info: unknown }>;
  export default pdfParse;
}
