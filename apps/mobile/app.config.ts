import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sıradaki',
  slug: 'siradaki',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#ffffff',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.siradaki.app',
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#ffffff',
    },
    package: 'com.siradaki.app',
  },
  plugins: [
    'expo-router',
    [
      'expo-font',
      {
        fonts: [
          './assets/fonts/Montserrat-Regular.otf',
          './assets/fonts/Montserrat-Medium.otf',
          './assets/fonts/Montserrat-SemiBold.otf',
          './assets/fonts/Montserrat-Bold.otf',
        ],
      },
    ],
  ],
  scheme: 'siradaki',
  experiments: {
    typedRoutes: true,
  },
});
