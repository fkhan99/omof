/**
 * Point Cloud Functions verification email at the OMOF Gmail sender.
 *
 * Prerequisites:
 *   1. Create omofverified@gmail.com (or your chosen address)
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

import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const firebaseDir = resolve(root, 'firebase');
const projectId = process.env.FIREBASE_PROJECT_ID ?? 'omof-eed24';

const smtpUser = process.env.OMOF_SMTP_USER ?? 'omofverified@gmail.com';
// Google displays app passwords in 4-character groups; SMTP needs 16 chars, no spaces.
const smtpPass = (process.env.OMOF_SMTP_PASS ?? '').replace(/\s/g, '');
const smtpFrom = process.env.OMOF_SMTP_FROM ?? `OMOF <${smtpUser}>`;
const smtpHost = process.env.OMOF_SMTP_HOST ?? 'smtp.gmail.com';
const smtpPort = process.env.OMOF_SMTP_PORT ?? '587';

if (!smtpPass) {
  console.error('Missing OMOF_SMTP_PASS (Gmail app password for the sender account).\n');
  console.error('Example (PowerShell):');
  console.error('  $env:OMOF_SMTP_PASS="your16charapppassword"');
  console.error('  node scripts/configure-verification-smtp.mjs');
  process.exit(1);
}

/** Quote args so Windows cmd.exe does not treat `<` / `>` as redirection. */
function shellArg(value) {
  if (process.platform === 'win32') {
    if (/[\s^&|<>"()]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  if (/[^\w@./:=+-]/.test(value)) {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
  return value;
}

function runFirebaseTools(...firebaseArgs) {
  const cmd = ['npx', 'firebase-tools', ...firebaseArgs].map(shellArg).join(' ');
  try {
    execSync(cmd, { cwd: firebaseDir, stdio: 'inherit', shell: true });
    return 0;
  } catch (error) {
    return error.status ?? 1;
  }
}

console.log(`Setting verification SMTP for project ${projectId}…`);
console.log(`  user: ${smtpUser}`);
console.log(`  from: ${smtpFrom}`);

// functions.config() is legacy but still used by verificationEmail.ts until migrated.
console.log('Enabling legacy Runtime Config CLI (required until config migration)…');
const enableLegacy = runFirebaseTools(
  'experiments:enable',
  'legacyRuntimeConfigCommands',
  '--project',
  projectId,
);
if (enableLegacy !== 0) {
  process.exit(enableLegacy);
}

const setConfig = runFirebaseTools(
  'functions:config:set',
  `omof.smtp_host=${smtpHost}`,
  `omof.smtp_port=${smtpPort}`,
  `omof.smtp_user=${smtpUser}`,
  `omof.smtp_pass=${smtpPass}`,
  `omof.smtp_from=${smtpFrom}`,
  '--project',
  projectId,
);

if (setConfig !== 0) {
  process.exit(setConfig);
}

console.log('\nSMTP config saved.');
console.log('Next: npm run firebase:deploy:functions');
console.log(
  '\nImportant: In Firebase Console → Authentication → Templates → SMTP settings,',
);
console.log(`set the sender to ${smtpUser} as well (for the Auth email fallback).`);
