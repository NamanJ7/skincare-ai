"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Field } from "@/components/auth/Field";
import { Button } from "@/components/ui/Button";
import { GoogleIcon, CheckIcon, CameraIcon } from "@/components/ui/icons";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

const SKIN_GOALS = [
  "Acne",
  "Dryness",
  "Texture",
  "Hyperpigmentation",
  "Sensitivity",
  "Building a routine",
  "Other",
];

export default function SignupPage() {
  const router = useRouter();
  const [goals, setGoals] = useState<string[]>(["Building a routine"]);

  const toggle = (goal: string) =>
    setGoals((prev) =>
      prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal],
    );

  return (
    <div className="w-full max-w-lg">
      <div className="rounded-[28px] border border-hairline bg-surface p-7 shadow-[var(--shadow-lift)] sm:p-9">
        <h1 className="font-display text-2xl text-ink">Create your account</h1>
        <p className="mt-1.5 text-sm text-ink-muted">
          Start with a guided face photo, then build a skincare routine that
          actually makes sense.
        </p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/waitlist/confirmed");
          }}
        >
          <Field id="name" label="Name" autoComplete="name" placeholder="Maya" required />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
            required
          />

          {/* skin goals */}
          <div>
            <span className="mb-2 block text-sm font-medium text-ink">
              What would you like help with most?
            </span>
            <div className="flex flex-wrap gap-2">
              {SKIN_GOALS.map((goal) => {
                const active = goals.includes(goal);
                return (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => toggle(goal)}
                    aria-pressed={active}
                    className={`inline-flex items-center gap-1.5 rounded-pill px-3.5 py-2 text-sm font-medium transition-all ${
                      active
                        ? "bg-primary text-on-primary"
                        : "border border-hairline bg-canvas text-ink-muted hover:text-ink"
                    }`}
                  >
                    {active ? <CheckIcon size={13} /> : null}
                    {goal}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[#e4dcf3] bg-accent-soft px-4 py-3">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent text-accent-ink">
                <CameraIcon size={16} />
              </span>
              <p className="text-sm leading-relaxed text-accent-ink">
                After signup, Pore will ask you to take a clear picture of your
                face so recommendations can start from what is visible, not just
                selected goals.
              </p>
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full">
            Create account
          </Button>

          {/* Acceptance at the point of account creation. Nothing records it
              yet -- there is no auth backend -- so this is notice, not an
              auditable consent record. */}
          <p className="text-center text-xs leading-relaxed text-ink-muted">
            By creating an account you agree to our{" "}
            <Link
              href="/terms"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Terms of Use
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              className="font-semibold text-primary underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-ink-muted">
          <span className="h-px flex-1 bg-hairline" />
          or
          <span className="h-px flex-1 bg-hairline" />
        </div>

        <Button
          href="/waitlist/confirmed"
          variant="secondary"
          size="lg"
          className="w-full"
        >
          <GoogleIcon size={18} />
          Sign up with Google
        </Button>

        <p className="mt-5 text-center text-sm text-ink-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-primary hover:underline">
            Log in
          </Link>
        </p>

        <p className="mt-5 border-t border-hairline pt-4 text-xs leading-relaxed text-ink-muted">
          {MEDICAL_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
