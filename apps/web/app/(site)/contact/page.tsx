import type { Metadata } from "next";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { WaitlistButton } from "@/components/ui/WaitlistButton";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Pore team.",
};

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Get in touch."
        lede="Questions, feedback, or partnership ideas? We'd love to hear from you."
      />
      <Section tone="canvas" className="pt-0 sm:pt-0">
        <div className="mx-auto max-w-xl rounded-[28px] border border-hairline bg-surface p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-base leading-relaxed text-ink-muted">
            Reach the Pore team any time at{" "}
            <a
              href="mailto:reachporeai@gmail.com"
              className="font-semibold text-primary hover:underline"
            >
              reachporeai@gmail.com
            </a>
            .
          </p>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">
            Want early access? Join the waitlist and you&apos;ll be first to know
            when we launch.
          </p>
          <div className="mt-6 flex justify-center">
            <WaitlistButton size="lg" />
          </div>
        </div>
      </Section>
    </>
  );
}
