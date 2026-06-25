import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms for using Pore.",
};

export default function TermsPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms of Use"
        lede="This is a placeholder set of terms for the Pore pre-launch site. Full terms will be published before launch."
      />
      <Section tone="canvas" className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-2xl space-y-5 text-base leading-relaxed text-ink-muted">
          <p>
            Pore provides personalized skincare education and routine guidance. It
            is intended to support your skincare journey, not to diagnose, treat,
            or replace professional medical advice.
          </p>
          <p>
            By joining the waitlist you agree to receive occasional product
            updates. You can unsubscribe at any time. Complete terms governing
            accounts, subscriptions, and acceptable use will be published when the
            product launches.
          </p>
          <p className="rounded-2xl border border-hairline bg-surface px-5 py-4 text-sm">
            {MEDICAL_DISCLAIMER}
          </p>
        </div>
      </Section>
    </>
  );
}
