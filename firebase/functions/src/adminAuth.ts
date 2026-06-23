import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

const VERIFY_CONTINUE_URL = 'https://omof-eed24.web.app/onboarding';

function getAdminUids(): Set<string> {
  const configured =
    functions.config().omof?.admin_uids
    ?? process.env.OMOF_ADMIN_UIDS
    ?? '';
  return new Set(
    configured
      .split(',')
      .map((value: string) => value.trim())
      .filter(Boolean),
  );
}

function assertAdmin(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'You must be signed in.');
  }

  const adminUids = getAdminUids();
  if (adminUids.size === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'No admin UIDs configured. Set omof.admin_uids in functions config.',
    );
  }

  if (!adminUids.has(context.auth.uid)) {
    throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
  }
}

export function createAdminEmailVerificationCallable() {
  return functions.https.onCall(async (data, context) => {
    assertAdmin(context);

    const email = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : '';
    const action = data?.action === 'markVerified' ? 'markVerified' : 'generateLink';

    if (!email || !email.includes('@')) {
      throw new functions.https.HttpsError('invalid-argument', 'A valid email is required.');
    }

    let user: admin.auth.UserRecord;
    try {
      user = await admin.auth().getUserByEmail(email);
    } catch {
      throw new functions.https.HttpsError('not-found', `No Auth user found for ${email}.`);
    }

    if (action === 'markVerified') {
      if (user.emailVerified) {
        return {
          success: true,
          email,
          uid: user.uid,
          emailVerified: true,
          message: 'Email was already verified.',
        };
      }

      await admin.auth().updateUser(user.uid, { emailVerified: true });
      functions.logger.info('[adminAuth] marked email verified', { email, uid: user.uid });

      return {
        success: true,
        email,
        uid: user.uid,
        emailVerified: true,
        message: 'Email marked as verified.',
      };
    }

    const link = await admin.auth().generateEmailVerificationLink(email, {
      url: VERIFY_CONTINUE_URL,
      handleCodeInApp: false,
    });

    functions.logger.info('[adminAuth] generated verification link', { email, uid: user.uid });

    return {
      success: true,
      email,
      uid: user.uid,
      emailVerified: user.emailVerified,
      verificationLink: link,
      message: user.emailVerified
        ? 'User is already verified; link generated anyway.'
        : 'Share this link with the user if inbox delivery fails.',
    };
  });
}
