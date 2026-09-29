import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medschoolproffs.app',
  appName: 'MedSchoolProffs',
  webDir: 'dist/public',

  // Android 15 (targetSdk 35) draws edge-to-edge, which put the app header
  // under the status bar. This insets the WebView below the system bars.
  android: {
    adjustMarginsForEdgeToEdge: 'force',
  },

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