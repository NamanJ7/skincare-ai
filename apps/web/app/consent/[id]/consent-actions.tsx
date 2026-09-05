"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function ConsentActions({ id, token }: { id: string; token: string }) {
  const [state, setState] = useState<"idle" | "loading" | "approved" | "denied" | "error">("idle");

  async function respond(decision: "approve" | "deny") {
    setState("loading");
    try {
      const res = await fetch(`/api/consent/${id}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, decision }),
      });
      if (!res.ok) throw new Error("request failed");
      setState(decision === "approve" ? "approved" : "denied");
    } catch {
      setState("error");
    }
  }

  if (state === "approved") {
    return <p className="mt-8 text-[17px] font-semibold text-ink">Approved. Your teen can continue in the app.</p>;
  }
  if (state === "denied") {
    return <p className="mt-8 text-[17px] font-semibold text-ink">Declined. Pore won&apos;t proceed with any photo.</p>;
  }

  return (
    <div className="mt-8 flex flex-wrap items-center gap-3">
      <Button onClick={() => respond("approve")} disabled={state === "loading"}>
        Approve
      </Button>
      <Button variant="secondary" onClick={() => respond("deny")} disabled={state === "loading"}>
        Deny
      </Button>
      {state === "error" ? (
        <span className="text-sm text-ink-muted">Something went wrong. Please try again.</span>
      ) : null}
    </div>
  );
}
