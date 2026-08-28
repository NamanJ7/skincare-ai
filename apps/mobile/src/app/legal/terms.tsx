import { TERMS_OF_USE } from "@pore/shared";

import { LegalScreen } from "@/components/legal/LegalScreen";

export default function TermsOfUseRoute() {
  return <LegalScreen doc={TERMS_OF_USE} />;
}
