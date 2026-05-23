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
  extra: {
    eas: {
      projectId: 'd1da3258-795a-4a62-b8ad-96c48e79a635',
    },
  },
});

export default (ctx: ConfigContext): ExpoConfig => {
  const cfg = baseConfig(ctx);
  return withGradleProperties(cfg as any, (props) => {
    const idx = props.modResults.findIndex(
      (item) => item.type === 'property' && item.key === 'org.gradle.jvmargs'
    );
    if (idx !== -1) {
      (props.modResults[idx] as { type: 'property'; key: string; value: string }).value =
        '-Xmx4096m -XX:MaxMetaspaceSize=512m';
    }
    return props;
  }) as ExpoConfig;
};
