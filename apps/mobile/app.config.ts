import { ExpoConfig, ConfigContext } from 'expo/config';
import { withGradleProperties } from '@expo/config-plugins';

const baseConfig = ({ config }: ConfigContext): ExpoConfig => ({
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
    infoPlist: {
      NSUserNotificationUsageDescription:
        'Yeni randevu ve hatırlatma bildirimleri almak için izin gerekiyor.',
    },
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
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
      },
    ],
    'expo-secure-store',
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
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: '#1E3A8A',
        defaultChannel: 'default',
        sounds: [],
      },
    ],
    [
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme: 'com.googleusercontent.apps.PLACEHOLDER_IOS_CLIENT_ID',
      },
    ],
  ],
  scheme: 'siradaki',
  updates: {
    url: 'https://u.expo.dev/d1da3258-795a-4a62-b8ad-96c48e79a635',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: 'd1da3258-795a-4a62-b8ad-96c48e79a635',
    },
  },
});

export default (ctx: ConfigContext): ExpoConfig => {
  const cfg = baseConfig(ctx);
  return withGradleProperties(cfg as any, (props) => {
    for (const item of props.modResults) {
      if (item.type !== 'property') continue;
      if (item.key === 'org.gradle.jvmargs') {
        item.value = '-Xmx4096m -XX:MaxMetaspaceSize=512m';
      }
      if (item.key === 'reactNativeArchitectures') {
        // Preview builds: arm64-v8a only (fast); production keeps all 4
        const arch = process.env.REACT_NATIVE_ARCHITECTURES;
        if (arch) item.value = arch;
      }
    }
    return props;
  }) as ExpoConfig;
};
