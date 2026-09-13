"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: this replaces the root layout, so it fires when the
 * layout itself threw. Styles are inline on purpose — the stylesheet is loaded
 * by the layout this component is standing in for, and a boundary that depends
 * on the thing that just failed is not a boundary.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error", error.digest ?? error.name);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "#F7F4EE",
          color: "#1F1F1F",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main role="alert" style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "0 0 12px" }}>
            Pore didn&apos;t load.
          </h1>
          <p style={{ fontSize: 16, lineHeight: 1.6, margin: "0 0 24px", color: "#5B5B5B" }}>
            Something went wrong before the page could start. Reloading usually
            fixes it.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              appearance: "none",
              border: "none",
              cursor: "pointer",
              borderRadius: 999,
              padding: "14px 28px",
              fontSize: 16,
              fontWeight: 600,
              backgroundColor: "#32483F",
              color: "#F7F4EE",
            }}
          >
            Reload
          </button>
          <p style={{ fontSize: 14, marginTop: 24, color: "#5B5B5B" }}>
            Still stuck?{" "}
            <a href="mailto:reachporeai@gmail.com" style={{ color: "#32483F" }}>
              reachporeai@gmail.com
            </a>
          </p>
        </main>
      </body>
    </html>
  );
}
