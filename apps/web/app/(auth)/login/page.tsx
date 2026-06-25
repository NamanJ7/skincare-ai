"use client";

import { useState } from "react";
import Link from "next/link";
import { Field } from "@/components/auth/Field";
import { Button } from "@/components/ui/Button";
import { GoogleIcon } from "@/components/ui/icons";
import { openWaitlist } from "@/lib/tally";

export default function LoginPage() {
  const [notice, setNotice] = useState(false);

  return (
    <div className="w-full max-w-md">
      <div className="rounded-[28px] border border-[#e4dcf3] bg-accent-soft p-1.5 shadow-[var(--shadow-lift)]">
        <div className="rounded-[22px] bg-surface p-7 sm:p-9">
          <h1 className="font-display text-2xl text-ink">Welcome back</h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            Log in to continue your skincare routine.
          </p>

          {notice ? (
            <div className="mt-5 rounded-xl border border-[#e4dcf3] bg-accent-soft px-4 py-3 text-sm text-accent-ink">
              Pore is launching soon — accounts open to waitlist members first.
            </div>
          ) : null}

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setNotice(true);
            }}
          >
            <Field
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
            />
            <Field
              id="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              hint="Forgot password?"
              required
            />
            <Button type="submit" size="lg" className="w-full">
              Log in
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
            <span className="h-px flex-1 bg-hairline" />
            or
            <span className="h-px flex-1 bg-hairline" />
          </div>

          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="w-full"
            onClick={() => setNotice(true)}
          >
            <GoogleIcon size={18} />
            Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-ink-muted">
            New to Pore?{" "}
            <Link href="/signup" className="font-semibold text-primary hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      <p className="mt-5 text-center text-sm text-ink-muted">
        Not ready yet?{" "}
        <button
          type="button"
          onClick={openWaitlist}
          className="font-semibold text-primary hover:underline"
        >
          Join the waitlist
        </button>
      </p>
    </div>
  );
}
