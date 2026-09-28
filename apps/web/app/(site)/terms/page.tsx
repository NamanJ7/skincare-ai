import type { Metadata } from "next";

import { TERMS_OF_USE } from "@pore/shared/legal";

import { LegalDocument } from "@/components/sections/LegalDocument";

export const metadata: Metadata = {
  title: TERMS_OF_USE.title,
  description: TERMS_OF_USE.lede,
};

export default function TermsPage() {
  return <LegalDocument document={TERMS_OF_USE} />;
}
