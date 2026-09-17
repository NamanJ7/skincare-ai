"use client";

import { useState } from "react";

import { Button } from "@/components/ui/Button";

/**
 * The parent presses Approve; only then does the server reveal the code.
 *
 * The reveal is a POST rather than part of the page load on purpose — see the
 * note in app/api/consent/approve/route.ts. A mail scanner opening the link
 * must not be able to approve anything.
 */
export function ApproveForm({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");

  async function approve() {
    setState("sending");
    try {
      const res = await fetch("/api/consent/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) {
        setMessage(data.error ?? "Something went wrong. Please try again.");
        setState("error");
        return;
      }
      setCode(data.code);
      setState("done");
    } catch {
      setMessage("Could not reach the server. Please try again.");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="mt-8 rounded-2xl border border-hairline bg-surface p-6 text-center shadow-[var(--shadow-card)]">
        <p className="text-sm text-ink-muted">Read this code out to them:</p>
        <p className="mt-3 font-display text-5xl tracking-[0.2em] text-ink" aria-live="polite">
          {code}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-ink-muted">
          They enter it in the app to finish. It stops working in 24 hours, and nothing is
          captured until it is entered. You can close this page now.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 text-center">
      <Button onClick={approve} size="lg" disabled={state === "sending"}>
        {state === "sending" ? "One moment…" : "I approve"}
      </Button>
      {state === "error" ? (
        <p className="mt-4 text-sm text-escalate" role="alert">
          {message}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-ink-muted">
        If you do not approve, close this page. Nothing happens and no photos are taken.
      </p>
    </div>
  );
}
