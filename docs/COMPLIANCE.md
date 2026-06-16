# OMOF Compliance Checklist

This document tracks legal and app-store compliance for OMOF. **In-app features are implemented; store console forms and hosted policy URLs still require your action before submission.**

## Implemented in the app

| Requirement | Location |
|-------------|----------|
| Privacy Policy (in-app) | Settings → Privacy Policy |
| Terms of Service (in-app) | Settings → Terms of Service |
| Signup age gate (13+) | Sign up screen checkbox |
| Signup terms acceptance | Sign up screen + stored on user profile |
| Account deletion | Settings → Privacy & Data → Delete account |
| Data export (GDPR/CCPA) | Settings → Privacy & Data → Download my data |
| Push notification consent | Device permission + Settings toggle |
| UGC reporting | Post/comment report flow |
| User blocking | Profile → Block; Settings → Blocked Users |
| Community guidelines | Settings → Community Guidelines |
| Crisis support modal | Post create/edit |
| Encryption export (exempt) | `ITSAppUsesNonExemptEncryption: false` in app.json |
| iOS permission strings | Camera, photos, microphone in app.json |

## Before Apple App Store submission

1. **Privacy Policy URL** — Host the policy at a public URL (e.g. `https://omof.app/privacy`) and enter it in App Store Connect. The in-app copy is the source of truth; keep both in sync.
2. **App Privacy labels** — In App Store Connect, declare data collected: email, user ID, photos/videos, user content, product interaction, crash data (if any analytics added). Firebase Auth + Firestore + Storage + push tokens.
3. **Age rating** — Complete the questionnaire honestly (UGC social app; likely 12+ or 17+ depending on mental-health framing).
4. **Account deletion** — Already in-app (Apple Guideline 5.1.1(v)).
5. **UGC** — Document moderation contact: safety@omof.app
6. **EAS / export compliance** — Already set to standard exempt encryption.

## Before Google Play submission

1. **Privacy policy URL** — Same hosted URL in Play Console.
2. **Data safety form** — Declare collection: account info, photos/videos, app activity, device IDs (push token). Mark data as not sold.
3. **Account deletion** — In-app deletion satisfies Play policy; optionally add the same URL in Play Console.
4. **UGC policy** — Reporting + blocking + guidelines documented.
5. **Families / COPPA** — App targets 13+; do not target children under 13.

## GDPR / UK GDPR / CCPA

| Right | How users exercise it |
|-------|------------------------|
| Access / portability | Privacy & Data → Download my data |
| Erasure | Privacy & Data → Delete account |
| Rectification | Edit Profile |
| Object / restrict | Privacy & Data → disable notifications; private account toggle |
| Contact | privacy@omof.app |

**Data processor:** Google Firebase (see Firebase DPA in Google Cloud console).

## Deploy Firestore rules after compliance update

```bash
npm run firebase:deploy:rules
```

## Not legal advice

Replace placeholder emails (`privacy@omof.app`, `safety@omof.app`, `support@omof.app`) with real monitored addresses before launch. Consult a lawyer for jurisdiction-specific requirements (EU representative, CCPA disclosures, etc.).
