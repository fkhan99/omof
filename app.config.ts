import { ExpoConfig, ConfigContext } from 'expo/config';

import appJson from './app.json';

const baseConfig = appJson.expo as ExpoConfig;

function getGoogleIosUrlScheme(): string | undefined {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  if (!iosClientId) return undefined;

  const clientPrefix = iosClientId.replace('.apps.googleusercontent.com', '');
  return `com.googleusercontent.apps.${clientPrefix}`;
}

function buildAuthPlugins(): NonNullable<ExpoConfig['plugins']> {
  const plugins: NonNullable<ExpoConfig['plugins']> = [...(baseConfig.plugins ?? [])];

  plugins.push('expo-apple-authentication');

  const iosUrlScheme = getGoogleIosUrlScheme();
  if (iosUrlScheme) {
    plugins.push([
      '@react-native-google-signin/google-signin',
      {
        iosUrlScheme,
      },
    ]);
  } else {
    plugins.push('@react-native-google-signin/google-signin');
  }

  return plugins;
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  ...baseConfig,
  ios: {
    ...baseConfig.ios,
    usesAppleSignIn: true,
  },
  plugins: buildAuthPlugins(),
  extra: {
    ...baseConfig.extra,
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? '',
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID ?? '',
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID ?? '',
    },
  },
});
