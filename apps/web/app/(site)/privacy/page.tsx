import type { Metadata } from "next";

import { PRIVACY_NOTICE } from "@pore/shared/legal";

import { LegalDocument } from "@/components/sections/LegalDocument";

export const metadata: Metadata = {
  title: PRIVACY_NOTICE.title,
  description: PRIVACY_NOTICE.lede,
};

export default function PrivacyPage() {
  return <LegalDocument document={PRIVACY_NOTICE} />;
}
