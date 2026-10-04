import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

// Automatic over-the-air updates for the native app.
//
// Every push to `main` runs .github/workflows/mobile-ota.yml, which builds the
// same student site that goes on the website and publishes it (plus a
// version.json manifest) to GitHub Pages. The app checks that manifest:
//   • at launch  — a new version is downloaded and applied immediately, so the
//     student opens straight into the latest UI (no "second launch" needed);
//   • whenever the app comes back to the foreground (at most every 5 minutes) —
//     the new version is downloaded quietly, and applied right away unless the
//     student is in the middle of an exam/practice session, in which case it
//     waits for the next launch/resume so nothing is lost.
// Web builds skip all of this. Native-shell changes (plugins, Android settings)
// still need a new APK — OTA only replaces the web bundle.

const MANIFEST_URL =
  'https://drumaiskhan.github.io/MedSchoolProffs/mobile-ota/version.json';

const MIN_CHECK_GAP_MS = 5 * 60 * 1000;
const BUSY_ROUTES = /^\/(practice|challenge|exams\/take|ospe-osce\/take|books\/[^/]+\/read)/i;

type UpdateManifest = { bundleId: string; url: string; checksum?: string };

let checking = false;
let lastCheck = 0;

// Downloads the newest bundle if there is one. Returns true when a new bundle
// is staged and ready to apply.
async function stageLatestBundle(): Promise<boolean> {
  const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) { console.warn('Could not fetch OTA manifest:', response.status); return false; }

  const manifest = (await response.json()) as UpdateManifest;
  if (!manifest.bundleId || !manifest.url) { console.warn('Invalid OTA manifest'); return false; }

  const { bundleId: current } = await LiveUpdate.getCurrentBundle();
  if (manifest.bundleId === current) return false;

  const { bundleId: next } = await LiveUpdate.getNextBundle();
  if (manifest.bundleId !== next) {
    await LiveUpdate.downloadBundle({
      url: manifest.url,
      bundleId: manifest.bundleId,
      ...(manifest.checksum ? { checksum: manifest.checksum } : {}),
    });
    await LiveUpdate.setNextBundle({ bundleId: manifest.bundleId });
  }
  return true;
}

async function checkForUpdate(applyNow: boolean) {
  if (checking) return;
  checking = true;
  lastCheck = Date.now();
  try {
    const staged = await stageLatestBundle();
    if (staged && applyNow) await LiveUpdate.reload();
  } catch (error) {
    console.error('GitHub OTA update failed:', error);
  } finally {
    checking = false;
  }
}

export async function initializeGithubLiveUpdate() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    // Must be called once per launch so the plugin knows this bundle boots fine
    // (otherwise it rolls back to the previous one).
    await LiveUpdate.ready();
  } catch (error) {
    console.error('LiveUpdate.ready failed:', error);
    return;
  }

  // Launch: apply straight away.
  void checkForUpdate(true);

  // Foreground: stage quietly, apply unless the student is mid-session.
  void App.addListener('appStateChange', ({ isActive }) => {
    if (!isActive || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
    const busy = BUSY_ROUTES.test(window.location.pathname);
    void checkForUpdate(!busy);
  });
}
