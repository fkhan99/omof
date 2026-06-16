export const MINIMUM_AGE = 13;

export const PRIVACY_POLICY_VERSION = '1.0.0';
export const TERMS_VERSION = '1.0.0';

export const PRIVACY_CONTACT_EMAIL = 'privacy@omof.app';
export const SAFETY_CONTACT_EMAIL = 'safety@omof.app';
export const SUPPORT_EMAIL = 'support@omof.app';

export const LEGAL_LAST_UPDATED = 'June 15, 2026';

export interface LegalSection {
  title: string;
  body: string;
}

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    title: 'Who we are',
    body:
      'OMOF ("we", "us") operates the OMOF mobile application — a social platform for sharing authentic experiences. Contact: privacy@omof.app.',
  },
  {
    title: 'Data we collect',
    body:
      'Account: email address, username, display name, bio, profile photo. Content: posts, captions, mood tags, photos, videos, comments, and reactions. Social: follow relationships, follow requests, blocks, and activity notifications. Device: push notification token (if you allow notifications). Usage: gamification stats, subscription plan (mock), and promotion data. We do not sell your personal data.',
  },
  {
    title: 'How we use data',
    body:
      'We use your data to provide the service (authentication, feed, profiles, messaging-style notifications), keep the community safe (reports, blocks, moderation), improve the app, and comply with law. Push tokens are used only to deliver notifications you expect from social activity.',
  },
  {
    title: 'Legal bases (GDPR)',
    body:
      'For users in the EEA/UK: we process data based on contract (providing the app), legitimate interests (safety, fraud prevention), and consent (push notifications, optional features). You may withdraw consent for notifications in Settings.',
  },
  {
    title: 'Children (COPPA)',
    body:
      `OMOF is not directed at children under ${MINIMUM_AGE}. You must confirm you are at least ${MINIMUM_AGE} years old to create an account. We do not knowingly collect data from children under ${MINIMUM_AGE}. Contact us to request deletion if you believe a child has registered.`,
  },
  {
    title: 'Your rights',
    body:
      'Depending on your location you may have rights to access, correct, delete, or export your data, and to object to or restrict certain processing. Use Settings → Privacy & Data to export or delete your account. EEA/UK users may lodge a complaint with their supervisory authority. California residents may exercise CCPA rights via privacy@omof.app.',
  },
  {
    title: 'Data retention',
    body:
      'We retain your data while your account is active. When you delete your account, we delete or anonymize associated personal data within a reasonable period, except where law requires retention (e.g. abuse reports).',
  },
  {
    title: 'International transfers',
    body:
      'Data may be processed in the United States and other countries where our service providers (including Google Firebase) operate. We rely on appropriate safeguards where required by law.',
  },
  {
    title: 'Service providers',
    body:
      'We use Google Firebase (authentication, database, storage, cloud functions, messaging infrastructure) to run OMOF. Their processing is governed by their terms and privacy policies.',
  },
  {
    title: 'Security',
    body:
      'We use industry-standard security including encrypted connections and Firebase security rules. No method of transmission is 100% secure.',
  },
  {
    title: 'Changes',
    body:
      `We may update this policy. Material changes will be reflected in the app. Last updated: ${LEGAL_LAST_UPDATED}. Version ${PRIVACY_POLICY_VERSION}.`,
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: 'Agreement',
    body:
      'By creating an account you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use OMOF.',
  },
  {
    title: 'Eligibility',
    body:
      `You must be at least ${MINIMUM_AGE} years old and able to form a binding contract. You are responsible for your account credentials.`,
  },
  {
    title: 'Your content',
    body:
      'You retain ownership of content you post. You grant OMOF a non-exclusive license to host, display, and distribute your content solely to operate the service. You must have rights to content you upload.',
  },
  {
    title: 'Acceptable use',
    body:
      'Do not post illegal content, harassment, hate speech, spam, impersonation, or content that promotes self-harm. Follow our Community Guidelines. We may remove content and suspend accounts that violate these terms.',
  },
  {
    title: 'User safety tools',
    body:
      'OMOF provides reporting, blocking, and community guidelines. OMOF is not a medical or crisis service. In emergencies contact local emergency services.',
  },
  {
    title: 'Subscriptions',
    body:
      'OMOF Plus and in-app promotions may be offered. Any mock or trial billing in test builds is not a real purchase. Production purchases will be governed by app store terms.',
  },
  {
    title: 'Termination',
    body:
      'You may delete your account at any time in Settings. We may suspend or terminate accounts that violate these terms or applicable law.',
  },
  {
    title: 'Disclaimers',
    body:
      'OMOF is provided "as is" without warranties. We are not liable for user-generated content or conduct of other users to the fullest extent permitted by law.',
  },
  {
    title: 'Governing law',
    body:
      'These terms are governed by the laws applicable in your jurisdiction where mandatory consumer protections apply. Disputes should first be raised with support@omof.app.',
  },
  {
    title: 'Contact',
    body:
      `Questions: ${SUPPORT_EMAIL}. Safety reports: ${SAFETY_CONTACT_EMAIL}. Last updated: ${LEGAL_LAST_UPDATED}. Version ${TERMS_VERSION}.`,
  },
];
