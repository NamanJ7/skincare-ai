import type { Metadata } from "next";

import { Logo } from "@/components/layout/Logo";
import { readToken } from "@/lib/consent";
import { ApproveForm } from "./ApproveForm";

export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Approve your teen's use of Pore",
  // A consent link is personal and single-purpose; it has no business in an index.
  robots: { index: false, follow: false },
};

export default async function ApprovePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  // Validity is checked here so an expired link says so plainly instead of
  // offering a button that cannot work. The code itself is never rendered on
  // load — it only comes back from the POST the button makes.
  const claims = token ? readToken(token) : null;

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg">
          {claims ? (
            <>
              <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
                Approve your teen&apos;s use of Pore
              </h1>
              <div className="mt-5 space-y-4 text-base leading-relaxed text-ink-muted">
                <p>
                  Someone aged {claims.age} gave your address as their parent or guardian. Pore
                  suggests a skincare routine from three photos of their face and a short
                  questionnaire.
                </p>
                <p>
                  The photos are kept on their phone. Each one is sent to our server and passed to
                  Anthropic to produce the assessment, and is not stored there. Pore does not train
                  on anyone&apos;s data or sell it.{" "}
                  <a
                    className="text-primary underline underline-offset-4"
                    href="/privacy"
                  >
                    Read the Privacy Policy
                  </a>
                  .
                </p>
                <p>No photos are taken unless you approve below.</p>
              </div>
              <ApproveForm token={token!} />
            </>
          ) : (
            <>
              <h1 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
                This link has expired
              </h1>
              <p className="mt-5 text-base leading-relaxed text-ink-muted">
                Approval links stop working after 24 hours. Ask them to start the approval step
                again in the app and a fresh email will arrive.
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
