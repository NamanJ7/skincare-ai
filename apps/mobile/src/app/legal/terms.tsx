import { TERMS_OF_USE } from "@pore/shared/legal";

import { LegalDocumentScreen } from "@/components/LegalDocumentScreen";

export default function TermsScreen() {
  return <LegalDocumentScreen document={TERMS_OF_USE} />;
}
