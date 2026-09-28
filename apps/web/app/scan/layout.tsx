import type { Metadata } from "next";
import { Logo } from "@/components/layout/Logo";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Skin scan — Pore",
  description: "A guided three-photo skin scan for personalized insights.",
  // Product surface, not a marketing page — keep it out of search.
  robots: { index: false, follow: false },
};

/**
 * Minimal chrome for the guided scan: logo + quiet disclaimer, no site nav.
 * The live camera screens overlay this shell edge-to-edge.
 */
export default function ScanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 flex-col px-5 pb-8 sm:px-8">{children}</main>
      <footer className="px-5 pb-8 sm:px-8">
        <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-ink-muted">
          {MEDICAL_DISCLAIMER}
        </p>
      </footer>
    </div>
  );
}
