import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.dasha.ostrov',
  appName: 'Наш остров',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
