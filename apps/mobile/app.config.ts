import { ExpoConfig, ConfigContext } from 'expo/config';
import { withGradleProperties } from '@expo/config-plugins';

const baseConfig = ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Sıradaki',
  slug: 'berber-randevu',
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
        iosUrlScheme: 'com.googleusercontent.apps.434882013340-odqk93o87gvag3j4u2ldbk5br0m34q0k',
      },
    ],
  ],
  scheme: 'siradaki',
  updates: {
    url: 'https://u.expo.dev/25ac450c-8b07-4703-805f-3d4fea1b8db7',
  },
  runtimeVersion: {
    policy: 'appVersion',
  },
  experiments: {
    typedRoutes: true,
  },
  extra: {
    eas: {
      projectId: '25ac450c-8b07-4703-805f-3d4fea1b8db7',
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
