import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.friday.app',
  appName: 'Friday',
  webDir: 'dist',
  ios: {
    minVersion: '17.0',
    contentInset: 'automatic',
  },
};

export default config;
