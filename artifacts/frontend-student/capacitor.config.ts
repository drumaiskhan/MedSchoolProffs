import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medschoolproffs.app',
  appName: 'MedSchoolProffs',
  webDir: 'dist/public',

  plugins: {
    LiveUpdate: {
      autoUpdateStrategy: 'none',
      autoDeleteBundles: true,
      autoBlockRolledBackBundles: true,
      readyTimeout: 10000,
    },
  },
};

export default config;