// Google Drive links as a book source. An admin pastes a Drive share link in
// Admin -> Books; the secure reader's server fetches the PDF from Drive (the
// student never sees the link for paid books).
//
// The file must be shared as "Anyone with the link" (Viewer). Large files make
// Drive answer with a "can't scan for viruses" page instead of the file; that
// page is a small form, which fetchDriveFile() submits to get the real bytes.

/** Returns the Drive file id for the common link shapes, or null if it isn't a Drive file link. */
export function parseDriveFileId(input: string): string | null {
  let u: URL;
  try { u = new URL(input.trim()); } catch { return null; }
  if (!/^(drive|docs)\.google\.com$|^drive\.usercontent\.google\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/) ?? u.pathname.match(/\/d\/([A-Za-z0-9_-]{10,})/);
  const id = m?.[1] ?? u.searchParams.get("id");
  return id && /^[A-Za-z0-9_-]{10,}$/.test(id) ? id : null;
}

/** One canonical form, so the same file always has the same stored path (and highlights keep matching it). */
export const canonicalDriveLink = (id: string): string => `https://drive.google.com/file/d/${id}/view`;

const decode = (s: string): string => s.replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const NOT_SHARED = "Google Drive wouldn't give the file. Open the file in Drive -> Share -> General access -> \"Anyone with the link\" (Viewer), then try again.";

export async function fetchDriveFile(id: string, timeoutMs: number): Promise<Response> {
  const first = `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}&export=download&confirm=t`;
  let res = await fetch(first, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
  if (res.status === 404) throw new Error("That Google Drive file was not found. Check the link.");
  if (!res.ok) throw new Error(`${NOT_SHARED} (Drive answered ${res.status}.)`);
  if (!(res.headers.get("content-type") ?? "").includes("text/html")) return res;

  // An HTML page: either the large-file virus-scan form (has a download form) or a sign-in / quota page.
  const html = await res.text();
  const action = /<form[^>]*id="download-form"[^>]*action="([^"]+)"/i.exec(html)?.[1] ?? /<form[^>]*action="([^"]*download[^"]*)"[^>]*>/i.exec(html)?.[1];
  if (action) {
    const url = new URL(decode(action));
    for (const m of html.matchAll(/<input[^>]*type="hidden"[^>]*>/gi)) {
      const name = /name="([^"]+)"/.exec(m[0])?.[1]; const value = /value="([^"]*)"/.exec(m[0])?.[1];
      if (name) url.searchParams.set(decode(name), decode(value ?? ""));
    }
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), redirect: "follow" });
    if (res.ok && !(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  }
  if (/quota|too many users/i.test(html)) throw new Error("Google Drive is temporarily limiting downloads of this file (too many recent downloads). Try again later.");
  throw new Error(NOT_SHARED);
}
