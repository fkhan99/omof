import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import nodemailer from 'nodemailer';

const VERIFY_CONTINUE_URL = 'https://omof-eed24.web.app/onboarding';

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

function getSmtpConfig(): SmtpConfig | null {
  const cfg = functions.config().omof ?? {};
  const host = (cfg.smtp_host ?? process.env.OMOF_SMTP_HOST ?? 'smtp.gmail.com') as string;
  const port = Number(cfg.smtp_port ?? process.env.OMOF_SMTP_PORT ?? 587);
  const user = (cfg.smtp_user ?? process.env.OMOF_SMTP_USER ?? '') as string;
  const pass = (cfg.smtp_pass ?? process.env.OMOF_SMTP_PASS ?? '') as string;
  const from = (cfg.smtp_from ?? process.env.OMOF_SMTP_FROM ?? `OMOF <${user}>`) as string;

  if (!user.trim() || !pass.trim()) {
    return null;
  }

  return { host, port, user, pass, from };
}

function buildVerificationEmailHtml(link: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #111;">Verify your OMOF email</h2>
      <p>Tap the button below to confirm your email address and finish signing up.</p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background:#111;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block;">
          Verify email
        </a>
      </p>
      <p style="color:#666;font-size:14px;">If the button does not work, copy this link into your browser:</p>
      <p style="color:#666;font-size:14px;word-break:break-all;">${link}</p>
    </div>
  `;
}

export function createRequestVerificationEmailCallable() {
  return functions.https.onCall(async (_data, context) => {
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'You must be signed in to request a verification email.',
      );
    }

    const user = await admin.auth().getUser(context.auth.uid);
    const email = user.email?.trim().toLowerCase();

    if (!email) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'This account has no email address.',
      );
    }

    if (user.emailVerified) {
      return { success: true, alreadyVerified: true };
    }

    const smtp = getSmtpConfig();
    if (!smtp) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Server email is not configured yet.',
      );
    }

    const link = await admin.auth().generateEmailVerificationLink(email, {
      url: VERIFY_CONTINUE_URL,
      handleCodeInApp: true,
    });

    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    await transporter.sendMail({
      from: smtp.from,
      to: email,
      subject: 'Verify your OMOF email',
      text: `Verify your OMOF email by opening this link:\n\n${link}`,
      html: buildVerificationEmailHtml(link),
    });

    functions.logger.info('[verificationEmail] sent via SMTP', { uid: user.uid, email });

    return { success: true, alreadyVerified: false, delivery: 'smtp' };
  });
}

export function isVerificationSmtpConfigured(): boolean {
  return getSmtpConfig() !== null;
}
