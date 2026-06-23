/**
 * Point Cloud Functions verification email at the OMOF Gmail sender.
 *
 * Prerequisites:
 *   1. Create omofverification@gmail.com (or your chosen address)
 *   2. Google Account → Security → 2-Step Verification → App passwords
 *   3. Generate an app password for "Mail"
 *
 * Usage (PowerShell):
 *   $env:OMOF_SMTP_PASS="your-16-char-app-password"
 *   node scripts/configure-verification-smtp.mjs
 *
 * Then redeploy the function:
 *   npm run firebase:deploy:functions
 *
 * Also update Firebase Console → Authentication → Templates → SMTP settings
 * so the client-side fallback uses the same sender (not your personal Gmail).
 */

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseDir = resolve(root, 'firebase');
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'omof-eed24';

const smtpUser = process.env.OMOF_SMTP_USER ?? 'omofverification@gmail.com';
const smtpPass = process.env.OMOF_SMTP_PASS?.trim() ?? '';
const smtpFrom = process.env.OMOF_SMTP_FROM ?? `OMOF <${smtpUser}>`;
const smtpHost = process.env.OMOF_SMTP_HOST ?? 'smtp.gmail.com';
const smtpPort = process.env.OMOF_SMTP_PORT ?? '587';

if (!smtpPass) {
  console.error('Missing OMOF_SMTP_PASS (Gmail app password for the sender account).\n');
  console.error('Example (PowerShell):');
  console.error('  $env:OMOF_SMTP_PASS="abcd efgh ijkl mnop"');
  console.error('  node scripts/configure-verification-smtp.mjs');
  process.exit(1);
}

const args = [
  'firebase-tools',
  'functions:config:set',
  `omof.smtp_host=${smtpHost}`,
  `omof.smtp_port=${smtpPort}`,
  `omof.smtp_user=${smtpUser}`,
  `omof.smtp_pass=${smtpPass}`,
  `omof.smtp_from=${smtpFrom}`,
  '--project',
  projectId,
];

console.log(`Setting verification SMTP for project ${projectId}…`);
console.log(`  user: ${smtpUser}`);
console.log(`  from: ${smtpFrom}`);

const result = spawnSync('npx', args, {
  cwd: firebaseDir,
  stdio: 'inherit',
  shell: true,
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

console.log('\nSMTP config saved.');
console.log('Next: npm run firebase:deploy:functions');
console.log(
  '\nImportant: In Firebase Console → Authentication → Templates → SMTP settings,',
);
console.log(`set the sender to ${smtpUser} as well (for the Auth email fallback).`);
