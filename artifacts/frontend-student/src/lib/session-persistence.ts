// "Remember me" support for the student app.
//
//  • Remember me ticked   → the server issues a 30-day session; nothing here is active.
//  • Remember me unticked → the server issues a browser-session cookie that is also
//    signed out after 30 min without requests (see api-server lib/deviceSessions.ts).
//    This file does the client half of "signed out when closed":
//      1. while the app is open it records a heartbeat and pings /auth/me every few
//         minutes, which keeps the server-side idle timer from firing;
//      2. when the app is opened again after the heartbeat has been silent for a while
//         (browser/tab was closed — including browsers that restore session cookies,
//         e.g. Chrome's "continue where you left off"), it signs the old session out
//         before the first render, so the login page shows instead of the dashboard.
//
// The flag lives in localStorage on the web (readable by every tab) and in memory in
// the native app, where the token itself is also kept in memory only (see native-auth.ts).
import { isNativeApp } from '@/lib/native-auth';

const TEMP_KEY = 'medschool.session.temp';       // '1' while the current login is NOT remembered
const ALIVE_KEY = 'medschool.session.lastActive'; // ms epoch, written by every open tab
const BEAT_MS = 15_000;
// A hidden tab's timers can be throttled to ~1/min, so only treat the app as
// closed after a clearly longer silence.
const CLOSED_AFTER_MS = 3 * 60_000;
const PING_MS = 5 * 60_000;

let nativeTemp = false;
let tracking = false;

function lsGet(key: string): string | null { try { return localStorage.getItem(key); } catch { return null; } }
function lsSet(key: string, value: string): void { try { localStorage.setItem(key, value); } catch { /* storage blocked */ } }
function lsRemove(key: string): void { try { localStorage.removeItem(key); } catch { /* storage blocked */ } }

function isTemporary(): boolean {
  return isNativeApp() ? nativeTemp : lsGet(TEMP_KEY) === '1';
}

function beat(): void {
  lsSet(ALIVE_KEY, String(Date.now()));
}

function startTracking(): void {
  if (tracking || !isTemporary()) return;
  tracking = true;
  beat();
  setInterval(beat, BEAT_MS);
  document.addEventListener('visibilitychange', beat);
  window.addEventListener('pagehide', beat);
  window.addEventListener('pageshow', beat);
  // Any authenticated request refreshes the server's idle timer; /auth/me is the cheapest.
  setInterval(() => {
    if (!isTemporary()) return;
    void import('@/lib/api').then(({ authApi }) => authApi.me()).catch(() => undefined);
  }, PING_MS);
}

/** Call right after a successful login with the state of the "Remember me" box. */
export function markSession(remember: boolean): void {
  if (isNativeApp()) nativeTemp = !remember;
  else if (remember) lsRemove(TEMP_KEY);
  else lsSet(TEMP_KEY, '1');
  if (remember) lsRemove(ALIVE_KEY);
  else startTracking();
}

/** Call when the user signs out (or the session is known to be gone). */
export function clearSessionMark(): void {
  nativeTemp = false;
  lsRemove(TEMP_KEY);
  lsRemove(ALIVE_KEY);
}

/**
 * Startup hook (web only), called before the first render. If the last login was
 * not remembered and the app has been closed since, signs that session out.
 * Never rejects and never blocks startup for more than a few seconds.
 */
export async function initSessionPersistence(signOut: () => Promise<unknown>): Promise<void> {
  if (isNativeApp() || !isTemporary()) return;
  const last = Number(lsGet(ALIVE_KEY));
  const closed = !Number.isFinite(last) || last <= 0 || Date.now() - last > CLOSED_AFTER_MS;
  if (closed) {
    try {
      await Promise.race([signOut(), new Promise((resolve) => setTimeout(resolve, 4000))]);
    } catch { /* offline or already signed out — the login page will show either way */ }
    clearSessionMark();
    return;
  }
  startTracking();
}
