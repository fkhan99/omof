import { LegalDocumentScreen } from '@/components/legal/LegalDocumentScreen';
import { LEGAL_LAST_UPDATED, TERMS_SECTIONS, TERMS_VERSION } from '@/constants/legal';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      intro="Please read these terms carefully before using OMOF."
      sections={TERMS_SECTIONS}
      version={TERMS_VERSION}
      lastUpdated={LEGAL_LAST_UPDATED}
    />
  );
}
