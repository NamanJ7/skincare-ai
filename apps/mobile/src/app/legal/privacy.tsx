import { PRIVACY_POLICY } from "@pore/shared";

import { LegalScreen } from "@/components/legal/LegalScreen";

export default function PrivacyPolicyRoute() {
  return <LegalScreen doc={PRIVACY_POLICY} />;
}
