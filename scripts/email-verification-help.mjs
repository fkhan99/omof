/**
 * Admin helper for email verification issues.
 *
 * Prerequisites:
 *   1. npm run firebase:build:functions
 *   2. GOOGLE_APPLICATION_CREDENTIALS pointing to a Firebase service account JSON, OR
 *      run: gcloud auth application-default login
 *
 * Usage:
 *   node scripts/email-verification-help.mjs jamesguan17@gmail.com
 *   node scripts/email-verification-help.mjs jamesguan17@gmail.com --verify
 *
 * --verify  Marks the email as verified in Firebase Auth (skips inbox delivery).
 */

import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname, '../firebase/functions/package.json'));

const emailArg = process.argv[2]?.trim().toLowerCase();
const markVerified = process.argv.includes('--verify');

if (!emailArg || !emailArg.includes('@')) {
  console.error('Usage: node scripts/email-verification-help.mjs <email> [--verify]');
  process.exit(1);
}

const admin = require('firebase-admin');
const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT ?? 'omof-eed24';
const VERIFY_CONTINUE_URL = 'https://omof-eed24.web.app/verify-email';

admin.initializeApp({
  projectId,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET ?? `${projectId}.firebasestorage.app`,
});

async function main() {
  const user = await admin.auth().getUserByEmail(emailArg);

  console.log('User:', {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    disabled: user.disabled,
    creationTime: user.metadata.creationTime,
    lastSignInTime: user.metadata.lastSignInTime,
  });

  if (markVerified) {
    if (user.emailVerified) {
      console.log('Already verified — nothing to do.');
      return;
    }
    await admin.auth().updateUser(user.uid, { emailVerified: true });
    console.log('Marked email as verified.');
    return;
  }

  const link = await admin.auth().generateEmailVerificationLink(emailArg, {
    url: VERIFY_CONTINUE_URL,
    handleCodeInApp: false,
  });

  console.log('\nVerification link (share if Gmail never receives Firebase mail):\n');
  console.log(link);
}

main().catch((error) => {
  console.error('Failed:', error.message ?? error);
  process.exit(1);
});
