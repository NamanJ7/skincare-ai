import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Pore handles your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy Policy"
        lede="This is a placeholder privacy policy for the Pore pre-launch site. A full policy will be published before launch."
      />
      <Section tone="canvas" className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-2xl space-y-5 text-base leading-relaxed text-ink-muted">
          <p>
            Pore collects only the information needed to operate the waitlist and,
            in the future, to provide personalized skincare guidance. We do not
            sell your personal information.
          </p>
          <p>
            Waitlist signups are handled through our form provider. When the
            product launches, this page will be replaced with a complete policy
            covering data storage, photo handling, retention, and your rights.
          </p>
          <p className="rounded-2xl border border-hairline bg-surface px-5 py-4 text-sm">
            {MEDICAL_DISCLAIMER}
          </p>
        </div>
      </Section>
    </>
  );
}
