/**
 * Purge all Firestore + Storage data for a user whose Auth account is already gone.
 *
 * Prerequisites:
 *   1. npm run firebase:build:functions
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase service account JSON, OR
 *      run: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/purge-user-data.mjs <firebaseAuthUid>
 *   npm run firebase:purge-user -- <firebaseAuthUid>
 */

import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, '../firebase/functions/package.json'));

const userId = process.argv[2]?.trim();
if (!userId) {
  console.error('Usage: node scripts/purge-user-data.mjs <firebaseAuthUid>');
  process.exit(1);
}

const compiledPath = resolve(__dirname, '../firebase/functions/lib/userDeletion.js');
if (!existsSync(compiledPath)) {
  console.error('Missing compiled functions. Run: npm run firebase:build:functions');
  process.exit(1);
}

const admin = require('firebase-admin');
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? 'omof-eed24';

admin.initializeApp({ projectId });
const { purgeAllUserData } = require(compiledPath);

console.log(`Purging all OMOF data for user ${userId} in project ${projectId}...`);

try {
  const summary = await purgeAllUserData(userId);
  console.log('Done:', JSON.stringify(summary, null, 2));
} catch (error) {
  console.error('Purge failed:', error);
  process.exit(1);
}
