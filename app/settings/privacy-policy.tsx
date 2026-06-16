import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import {
  LEGAL_LAST_UPDATED,
  PRIVACY_POLICY_SECTIONS,
  PRIVACY_POLICY_VERSION,
} from '@/constants/legal';

export default function PrivacyPolicyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      intro="This policy explains how OMOF collects, uses, and protects your personal data."
      sections={PRIVACY_POLICY_SECTIONS}
      version={PRIVACY_POLICY_VERSION}
      lastUpdated={LEGAL_LAST_UPDATED}
    />
  );
}
