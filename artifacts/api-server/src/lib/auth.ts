import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-only-insecure-secret-change-me";
if (!process.env.JWT_SECRET && process.env.NODE_ENV === "production") {
  // eslint-disable-next-line no-console
  console.warn("[auth] JWT_SECRET is not set. Using an insecure default — set JWT_SECRET in production.");
}

const JWT_EXPIRY = "7d";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // keep in step with JWT_EXPIRY / cookie maxAge
const BCRYPT_ROUNDS = 12;

export interface SessionPayload {
  sub: number; // user id
  role: string; // student | admin (legacy "superadmin" rows are normalized to "admin" at boot — see lib/normalizeLegacyRoles.ts)
  passwordChangedAt: number; // ms epoch, used to invalidate tokens after password change
  sid?: string; // med_user_sessions.token_id — the device this token belongs to (see lib/deviceSessions.ts)
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Generates a URL-safe random token and returns both the raw token (to email/send)
 *  and its sha256 hash (to store in the DB). Never store the raw token. */
export function generateOneTimeToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString("base64url");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

/** Generates a 6-digit numeric OTP (e.g. for email verification) and returns
 *  both the plain code (to email) and its sha256 hash (to store in the DB).
 *  Never store the plain code. crypto.randomInt is uniform over
 *  [0, 1_000_000) — zero-padded so e.g. 42 becomes "000042", not "42". */
export function generateOtp(): { code: string; hash: string } {
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  const hash = crypto.createHash("sha256").update(code).digest("hex");
  return { code, hash };
}

export const SESSION_COOKIE_NAME = "medschool_session";
export const ADMIN_SESSION_COOKIE_NAME = "medschool_admin_session";

// The admin site and the student site both call this one API host, so a single
// cookie name meant logging into one app (e.g. registering a test student)
// silently replaced the other app's session. Each app now gets its own cookie.
// The calling app is identified from the request's Origin (falling back to
// Referer for plain navigations/downloads): an origin listed in ADMIN_APP_URL
// (comma-separated, e.g. https://admin.medschoolproffs.live) — or, when that
// env var is unset, any host whose name starts with "admin." — is the admin app.
// Anything else (including no Origin/Referer at all) is treated as "unknown".
function requestOriginHost(req: import("express").Request): { origin: string; host: string } | null {
  const raw = (req.headers.origin as string | undefined) || (req.headers.referer as string | undefined);
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return { origin: u.origin, host: u.hostname };
  } catch {
    return null;
  }
}

export function isAdminAppRequest(req: import("express").Request): boolean {
  const o = requestOriginHost(req);
  if (!o) return false;
  const configured = (process.env.ADMIN_APP_URL || "").split(",").map((v) => v.trim().replace(/\/$/, "")).filter(Boolean);
  if (configured.length > 0) return configured.includes(o.origin);
  return o.host.startsWith("admin.");
}

/** True when the request clearly comes from a browser page that is NOT the admin app. */
function isKnownStudentAppRequest(req: import("express").Request): boolean {
  return requestOriginHost(req) !== null && !isAdminAppRequest(req);
}

/** The cookie name this request's app should use for reading, setting and clearing its session. */
export function sessionCookieNameFor(req: import("express").Request): string {
  return isAdminAppRequest(req) ? ADMIN_SESSION_COOKIE_NAME : SESSION_COOKIE_NAME;
}

/** The session cookie value for this request's app. A request with no Origin/Referer
 * (e.g. typing an API URL into the address bar) can't be attributed to an app, so
 * it accepts either cookie. */
export function readSessionCookie(req: import("express").Request): string | null {
  const cookies = req.cookies ?? {};
  if (isAdminAppRequest(req)) return cookies[ADMIN_SESSION_COOKIE_NAME] || null;
  if (isKnownStudentAppRequest(req)) return cookies[SESSION_COOKIE_NAME] || null;
  return cookies[SESSION_COOKIE_NAME] || cookies[ADMIN_SESSION_COOKIE_NAME] || null;
}

// This deployment is always split-domain: the frontend(s) run on Netlify
// and the API server runs on a separate host (Railway/Render). Cross-site
// fetch/XHR calls only carry cookies when they're set as
// SameSite=None; Secure — SameSite=Lax (the old default here) is silently
// dropped on JS-initiated cross-origin requests, which caused login
// to succeed (200) but the very next /me check to come back 401 and
// bounce the user straight back to /login. Hardcoded to "none"/secure
// rather than gated behind an env var so this can't regress by forgetting
// to set COOKIE_CROSS_SITE=true on the API host.
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
};