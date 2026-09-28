import { PRIVACY_NOTICE } from "@pore/shared/legal";

import { LegalDocumentScreen } from "@/components/LegalDocumentScreen";

export default function PrivacyNoticeScreen() {
  return <LegalDocumentScreen document={PRIVACY_NOTICE} />;
}
