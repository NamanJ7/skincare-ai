"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LEGAL_CONFIG } from "@pore/shared/legal";

/**
 * Route-level error boundary.
 *
 * Deliberately shows no `error.message` and no digest: a server exception
 * string is an internal detail, and pasting it into the page is how stack
 * traces and query fragments end up in screenshots. The same rule the mobile
 * `AppErrorBoundary` follows.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side console only. No error-reporting vendor ships today; when one
    // is added, this is the hook it belongs on.
    console.error("Unhandled route error", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] items-center bg-canvas py-16">
      <Container>
        <div className="mx-auto max-w-xl text-center" role="alert">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Something broke on our side
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.06] text-ink sm:text-5xl">
            This page didn&apos;t load.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
            Nothing you entered was lost. Try again — if it keeps happening, let
            us know and we will look into it.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={reset}>
              Try again
            </Button>
            <Button href="/" variant="secondary" size="lg">
              Back to home
            </Button>
          </div>

          <p className="mt-8 text-sm text-ink-muted">
            Still stuck?{" "}
            <a
              className="font-semibold text-primary hover:underline"
              href={`mailto:${LEGAL_CONFIG.supportEmail}`}
            >
              {LEGAL_CONFIG.supportEmail}
            </a>
          </p>
        </div>
      </Container>
    </main>
  );
}
