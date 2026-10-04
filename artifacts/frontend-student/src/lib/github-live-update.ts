import { Capacitor } from '@capacitor/core';
import { LiveUpdate } from '@capawesome/capacitor-live-update';

const MANIFEST_URL =
  'https://drumaiskhan.github.io/MedSchoolProffs/mobile-ota/version.json';

type UpdateManifest = {
  bundleId: string;
  url: string;
  checksum?: string;
};

export async function initializeGithubLiveUpdate() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await LiveUpdate.ready();

    const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn('Could not fetch OTA manifest:', response.status);
      return;
    }

    const manifest = (await response.json()) as UpdateManifest;

    if (!manifest.bundleId || !manifest.url) {
      console.warn('Invalid OTA manifest');
      return;
    }

    const { bundleId: currentBundleId } =
      await LiveUpdate.getCurrentBundle();

    const { bundleId: nextBundleId } =
      await LiveUpdate.getNextBundle();

    if (
      manifest.bundleId === currentBundleId ||
      manifest.bundleId === nextBundleId
    ) {
      return;
    }

    await LiveUpdate.downloadBundle({
      url: manifest.url,
      bundleId: manifest.bundleId,
      ...(manifest.checksum
        ? { checksum: manifest.checksum }
        : {}),
    });

    await LiveUpdate.setNextBundle({
      bundleId: manifest.bundleId,
    });

    console.log(
      `OTA update ${manifest.bundleId} downloaded and will apply next launch.`,
    );
  } catch (error) {
    console.error('GitHub OTA update failed:', error);
  }
}