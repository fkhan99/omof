import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { initializeApp, getApps, FirebaseApp, FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  browserLocalPersistence,
  Auth,
} from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export interface FirebaseEnvConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

const ENV_MAP: Record<keyof FirebaseEnvConfig, string> = {
  apiKey: 'EXPO_PUBLIC_FIREBASE_API_KEY',
  authDomain: 'EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN',
  projectId: 'EXPO_PUBLIC_FIREBASE_PROJECT_ID',
  storageBucket: 'EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'EXPO_PUBLIC_FIREBASE_APP_ID',
};

const PLACEHOLDER_PATTERNS = [
  /^your[_-]/i,
  /^replace/i,
  /^xxx+$/i,
  /^todo/i,
  /^change[_-]?me/i,
  /^insert[_-]/i,
  /^add[_-]your/i,
];

export class FirebaseNotConfiguredError extends Error {
  constructor(message = 'Firebase is not configured. Add your keys to a .env file and restart Expo.') {
    super(message);
    this.name = 'FirebaseNotConfiguredError';
  }
}

function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function readEnvValue(key: keyof FirebaseEnvConfig): string {
  const envKey = ENV_MAP[key];
  const fromProcess = process.env[envKey];
  if (fromProcess?.trim()) return fromProcess.trim();

  const fromExtra = Constants.expoConfig?.extra?.firebase?.[key];
  if (typeof fromExtra === 'string' && fromExtra.trim()) return fromExtra.trim();

  return '';
}

function buildFirebaseConfig(): FirebaseEnvConfig | null {
  const config: FirebaseEnvConfig = {
    apiKey: readEnvValue('apiKey'),
    authDomain: readEnvValue('authDomain'),
    projectId: readEnvValue('projectId'),
    storageBucket: readEnvValue('storageBucket'),
    messagingSenderId: readEnvValue('messagingSenderId'),
    appId: readEnvValue('appId'),
  };

  const missingOrPlaceholder = (Object.keys(config) as (keyof FirebaseEnvConfig)[]).filter((key) =>
    isPlaceholder(config[key]),
  );

  if (missingOrPlaceholder.length > 0) {
    if (__DEV__) {
      console.warn(
        '[OMOF] Firebase config incomplete. Missing or placeholder values for:',
        missingOrPlaceholder.join(', '),
        '\nCopy .env.example to .env, add your Firebase Web app credentials, then restart with: npx expo start -c',
      );
    }
    return null;
  }

  return config;
}

const resolvedConfig = buildFirebaseConfig();

export function isFirebaseConfigured(): boolean {
  return resolvedConfig !== null;
}

export function getFirebaseEnvConfig(): FirebaseEnvConfig | null {
  return resolvedConfig;
}

export function getMissingFirebaseEnvKeys(): string[] {
  if (!resolvedConfig) {
    return (Object.keys(ENV_MAP) as (keyof FirebaseEnvConfig)[]).filter((key) =>
      isPlaceholder(readEnvValue(key)),
    ).map((key) => ENV_MAP[key]);
  }
  return [];
}

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

function requireFirebaseConfig(): FirebaseOptions {
  if (!resolvedConfig) {
    throw new FirebaseNotConfiguredError();
  }
  return resolvedConfig;
}

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const config = requireFirebaseConfig();
    app = getApps().length === 0 ? initializeApp(config) : getApps()[0];
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    const firebaseApp = getFirebaseApp();
    if (Platform.OS === 'web') {
      try {
        auth = initializeAuth(firebaseApp, { persistence: browserLocalPersistence });
      } catch {
        auth = getAuth(firebaseApp);
      }
    } else {
      auth = getAuth(firebaseApp);
    }
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    storage = getStorage(getFirebaseApp());
  }
  return storage;
}
