import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.medschoolproffs.student',
  appName: 'MedSchoolProffs',
  webDir: 'dist/public',

  server: {
    url: 'https://medschoolproffs.live',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;