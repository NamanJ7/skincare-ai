import type { Metadata } from "next";
import { TERMS_OF_USE } from "@pore/shared";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using Pore.",
};

export default function TermsPage() {
  return <LegalPage doc={TERMS_OF_USE} />;
}
