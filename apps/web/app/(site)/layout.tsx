import Script from "next/script";

import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      {/*
        Tally popup widget — drives every "Join the Waitlist" CTA (form LZVOM2),
        which lives in SiteHeader and so appears on every marketing page.

        Scoped to (site) rather than the root layout on purpose: it used to load
        on /scan too, injecting a third-party script into the one page that
        operates the user's camera and holds face photos in IndexedDB. That page
        has no waitlist CTA and no reason to carry it.
      */}
      <Script
        src="https://tally.so/widgets/embed.js"
        strategy="afterInteractive"
      />
    </>
  );
}
