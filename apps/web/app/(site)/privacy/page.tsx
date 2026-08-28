import type { Metadata } from "next";
import { PRIVACY_POLICY } from "@pore/shared";
import { LegalPage } from "@/components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pore handles your information.",
};

export default function PrivacyPage() {
  return <LegalPage doc={PRIVACY_POLICY} />;
}
