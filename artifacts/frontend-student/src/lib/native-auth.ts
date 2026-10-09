// Native-only (Capacitor) bearer-token storage for the student app.
//
// The normal website authenticates with the HttpOnly `medschool_session`
// cookie and must keep doing so — nothing in this file is active in a browser:
// every entry point checks Capacitor.isNativePlatform() first and is a no-op
// (or returns null) on the web. The token is never put in localStorage.
//
// Inside the Android WebView, cross-origin cookies are unreliable, so the
// native app keeps the token returned by POST /api/auth/login in Capacitor
// Preferences (Android SharedPreferences, app-private, persists across
// launches and OTA bundle swaps) and sends it as `Authorization: Bearer`.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { setAuthTokenGetter } from '@workspace/api-client-react';

const TOKEN_KEY = 'medschool.native.authToken';

/** True only inside the Capacitor Android/iOS shell, never in a browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

// In-memory copy so request headers are built synchronously once restored.
let memoryToken: string | null = null;
let restorePromise: Promise<void> | null = null;

/** Reads the saved token from native storage (once). Never rejects. */
export function restoreNativeAuthToken(): Promise<void> {
  if (!isNativeApp()) return Promise.resolve();
  if (!restorePromise) {
    restorePromise = Preferences.get({ key: TOKEN_KEY })
      .then(({ value }) => { memoryToken = value || null; })
      .catch((err) => { console.warn('Could not restore native auth token:', err); memoryToken = null; });
  }
  return restorePromise;
}

/**
 * The current bearer token, or null on the web / when signed out. Waits for
 * the startup restore so no request can read the token before it is loaded.
 */
export async function getNativeAuthToken(): Promise<string | null> {
  if (!isNativeApp()) return null;
  await restoreNativeAuthToken();
  return memoryToken;
}

/**
 * Synchronous variant for fire-and-forget calls that cannot await (e.g. a
 * keepalive request while the page is closing). Only meaningful after
 * initNativeAuth() has resolved, which the app guarantees before first render.
 */
export function peekNativeAuthToken(): string | null {
  return isNativeApp() ? memoryToken : null;
}

/**
 * Stores a freshly issued login token. The in-memory copy is updated first,
 * so both API clients can use it immediately even before the write finishes.
 * `persist` = the "Remember me" box: when false the token lives in memory only
 * (any previously saved one is removed), so closing the app signs the user out.
 */
export async function setNativeAuthToken(token: string, persist: boolean = true): Promise<void> {
  if (!isNativeApp()) return;
  await restoreNativeAuthToken();
  memoryToken = token;
  if (persist) await Preferences.set({ key: TOKEN_KEY, value: token });
  else await Preferences.remove({ key: TOKEN_KEY });
}

/** Forgets the token (logout / expired session). Never rejects. */
export async function clearNativeAuthToken(): Promise<void> {
  if (!isNativeApp()) return;
  await restoreNativeAuthToken();
  memoryToken = null;
  try { await Preferences.remove({ key: TOKEN_KEY }); }
  catch (err) { console.warn('Could not clear native auth token:', err); }
}

/**
 * Startup hook: restores the saved token, then points the generated API
 * client at it. Resolves before the app renders so /auth/me never fires
 * without the token. A no-op on the web — the generated client's getter is
 * deliberately left unset there (cookies only).
 */
export async function initNativeAuth(): Promise<void> {
  if (!isNativeApp()) return;
  await restoreNativeAuthToken();
  setAuthTokenGetter(getNativeAuthToken);
}
