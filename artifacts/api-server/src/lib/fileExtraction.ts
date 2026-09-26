import path from "node:path";

export interface FileExtractionResult {
  kind: "text" | "rows";
  text?: string;
  rows?: string[][];
}

/**
 * Extracts content from an uploaded MCQ source file, regardless of format.
 * .xlsx/.xls/.csv return structured rows (best for column-mapped imports);
 * .pdf/.docx/.txt return raw text (for pattern-based extraction).
 */
export async function extractFileContent(buffer: Buffer, originalName: string, mimeType: string): Promise<FileExtractionResult> {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === ".xlsx" || ext === ".xls" || mimeType.includes("spreadsheet") || mimeType.includes("ms-excel")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "" }) as string[][];
    return { kind: "rows", rows };
  }

  if (ext === ".csv" || mimeType.includes("csv")) {
    // Strip a UTF-8 BOM (common from Excel/Google Sheets exports) so the
    // header row's first cell — e.g. "Question_ID" — doesn't come through
    // as "\uFEFFQuestion_ID" and silently fail every header-alias match.
    let text = buffer.toString("utf8");
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const rows = parseCsv(text);
    return { kind: "rows", rows };
  }

  if (ext === ".pdf" || mimeType === "application/pdf") {
    // Import the package's internal implementation file, NOT its index.js.
    // pdf-parse's index.js has a leftover debug block:
    //   let isDebugMode = !module.parent;
    //   if (isDebugMode) { fs.readFileSync('./test/data/05-versions-space.pdf') ... }
    // meant to only run when the package is executed directly for its own
    // tests. Under a normal (unbundled) `require`, module.parent is set
    // correctly and this never fires — which is why this works locally.
    // But api-server's build.mjs bundles the whole backend into one file
    // with esbuild, and pdf-parse wasn't in its `external` list — once
    // esbuild inlines a CJS module like that, there's no real module.parent
    // chain, isDebugMode evaluates true, and it tries to read a test
    // fixture that doesn't exist in the production dist/ folder, throwing
    // ENOENT and rejecting the import on every PDF parse on live. Importing
    // straight from lib/pdf-parse.js skips index.js (and its debug block)
    // entirely — same parsing function, none of the side effects, works
    // the same whether esbuild bundles it or not.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    const result = await pdfParse(buffer);
    return { kind: "text", text: result.text };
  }

  if (ext === ".docx" || mimeType.includes("wordprocessingml")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return { kind: "text", text: result.value };
  }

  // Fallback: treat as plain text (.txt and anything else we don't recognize)
  return { kind: "text", text: buffer.toString("utf8") };
}

/**
 * Full-text CSV parser (replaces the old line-by-line parseCsvLine, which
 * split on "\n" BEFORE handling quotes — so any quoted cell containing a
 * literal newline, e.g. a multi-paragraph explanation pasted from a Word
 * doc or a Google Sheets export, silently split into two corrupted rows
 * instead of staying one cell). This scans the whole buffer character by
 * character so a newline inside an open quote is just part of the cell.
 * Handles doubled-quote ("") escaping the same as before, and both \r\n and
 * \n line endings.
 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  const endCell = () => { row.push(cell); cell = ""; };
  const endRow = () => { endCell(); rows.push(row); row = []; };
  while (i < n) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (char === '"') { inQuotes = false; i++; continue; }
      cell += char; i++; continue;
    }
    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ",") { endCell(); i++; continue; }
    if (char === "\r" && text[i + 1] === "\n") { endRow(); i += 2; continue; }
    if (char === "\n" || char === "\r") { endRow(); i++; continue; }
    cell += char; i++;
  }
  // Final cell/row if the file doesn't end on a line break.
  if (cell.length > 0 || row.length > 0) endRow();
  // Drop fully-empty trailing/blank lines (e.g. a stray newline at EOF),
  // same as the old filter((line) => line.length > 0) did.
  return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}
