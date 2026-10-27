// Big book PDFs (over 200 MB) are kept on the cPanel disk through the small PHP "file bridge"
// (see /cpanel-filebridge in the project root). Only this server talks to it, with a shared secret;
// students never receive a link to these files - they read through the secure reader.
import { logger } from "./logger";

export const CPANEL_PREFIX = "cpanel:";
export const isCpanelPath = (p: string | null | undefined): p is string => !!p && p.startsWith(CPANEL_PREFIX);
export const cpanelName = (p: string): string => p.slice(CPANEL_PREFIX.length);

/** Books at or above this size go to cPanel (the admin page chunks the upload itself). */
export const CPANEL_THRESHOLD_BYTES = 200 * 1024 * 1024;

export class CpanelError extends Error { constructor(msg: string, public status = 502) { super(msg); } }

function config(): { url: string; secret: string } | null {
  const secret = process.env.FILE_BRIDGE_SECRET || "";
  let url = process.env.FILE_BRIDGE_URL || "";
  if (!url && process.env.DB_BRIDGE_URL) {
    try { url = new URL("/filebridge/index.php", process.env.DB_BRIDGE_URL).href; } catch { /* bad DB_BRIDGE_URL */ }
  }
  return secret && url ? { url, secret } : null;
}
export const cpanelConfigured = (): boolean => config() !== null;

function call(action: string, name: string, extra: Record<string, string | number> = {}, init: RequestInit = {}, timeoutMs = 60_000): Promise<Response> {
  const cfg = config();
  if (!cfg) throw new CpanelError("cPanel file storage is not set up yet (FILE_BRIDGE_SECRET / FILE_BRIDGE_URL).", 503);
  const u = new URL(cfg.url);
  u.searchParams.set("a", action); if (name) u.searchParams.set("name", name);
  for (const [k, v] of Object.entries(extra)) u.searchParams.set(k, String(v));
  return fetch(u, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), "X-Bridge-Secret": cfg.secret }, signal: AbortSignal.timeout(timeoutMs) });
}

async function json(res: Response): Promise<{ ok: boolean; size?: number; error?: string }> {
  const data = await res.json().catch(() => null) as { ok?: boolean; size?: number; error?: string } | null;
  if (!res.ok || !data?.ok) throw new CpanelError(data?.error || `cPanel storage answered ${res.status}.`, res.status === 413 || res.status === 507 ? 413 : 502);
  return { ok: true, size: data.size };
}

/** Adds one piece of a file at `offset`. Safe to repeat: the bridge accepts a piece it already has. */
export async function cpanelAppend(name: string, offset: number, chunk: Buffer): Promise<number> {
  try { return (await json(await call("append", name, { offset }, { method: "POST", body: new Uint8Array(chunk), headers: { "Content-Type": "application/octet-stream" } }, 120_000))).size ?? offset + chunk.length; }
  catch (err) { if (err instanceof CpanelError) throw err; logger.error({ err }, "[cpanel] append failed"); throw new CpanelError("Could not reach the cPanel storage. Check FILE_BRIDGE_URL and that the bridge is installed."); }
}
export async function cpanelFinish(name: string): Promise<number> {
  try { return (await json(await call("finish", name, {}, { method: "POST" }))).size ?? 0; }
  catch (err) { if (err instanceof CpanelError) throw err; throw new CpanelError("Could not finish the file on cPanel."); }
}
/** The whole file as a streaming response (the reader keeps its own disk copy afterwards). */
export async function cpanelGet(name: string, timeoutMs = 900_000): Promise<Response> {
  return call("get", name, {}, { method: "GET" }, timeoutMs);
}
export async function cpanelDelete(p: string): Promise<{ ok: boolean; error?: string }> {
  try { await json(await call("delete", cpanelName(p), {}, { method: "POST" })); return { ok: true }; }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : "Could not delete the file on cPanel." }; }
}
