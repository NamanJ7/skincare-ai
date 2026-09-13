"use client";

/**
 * Age and photo consent, shown before the camera is ever requested.
 *
 * The Privacy Notice states that "All users are asked separately before any
 * face photo is captured" and describes a 13+ product with guardian
 * involvement for minors. That was true of the mobile app and false here: the
 * web scan opened getUserMedia with no gate at all.
 *
 * This is deliberately lighter than the mobile flow (which records a versioned
 * consent and a guardian PIN credential) because the web scan is local-only —
 * photos stay in this browser's IndexedDB and nothing is transmitted. What it
 * does guarantee is that nobody reaches the camera without stating an age band
 * and affirming the photo terms.
 *
 * Consent is re-asked on every visit rather than persisted, matching the
 * mobile flow's "deliberately unchecked on every visit" rule.
 */
import { useId, useState } from "react";
import Link from "next/link";

import { MIN_SUPPORTED_AGE, ageTierFor } from "@pore/shared";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type AgeBand = "under_13" | "13_17" | "18_plus";

/** Representative age per band, so the shared policy stays the single source. */
const BAND_AGE: Record<AgeBand, number> = {
  under_13: 12,
  "13_17": 15,
  "18_plus": 18,
};

const BANDS: Array<{ value: AgeBand; label: string }> = [
  { value: "under_13", label: `Under ${MIN_SUPPORTED_AGE}` },
  { value: "13_17", label: `${MIN_SUPPORTED_AGE}–17` },
  { value: "18_plus", label: "18 or older" },
];

export function ScanConsentGate({ onAccept }: { onAccept: () => void }) {
  const [band, setBand] = useState<AgeBand | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);
  const groupId = useId();

  const tier = band ? ageTierFor(BAND_AGE[band]) : null;
  const blocked = tier === "under_13";
  const needsGuardian = band === "13_17";
  const ready =
    band !== null && !blocked && photoConsent && (!needsGuardian || guardianConsent);

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <Card className="p-7 sm:p-9">
        <h1 className="font-display text-2xl text-ink">Before you scan</h1>
        <p className="mt-2 text-sm text-ink-muted">
          The scan uses your camera to take three guided face photos. Pore
          checks them for quality in this browser.
        </p>

        <fieldset className="mt-7">
          <legend className="text-sm font-medium text-ink">
            How old are you?
          </legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {BANDS.map((option) => (
              <label
                key={option.value}
                className={`cursor-pointer rounded-pill border px-4 py-2 text-sm transition-colors ${
                  band === option.value
                    ? "border-ink bg-ink text-canvas"
                    : "border-hairline text-ink-muted hover:text-ink"
                }`}
              >
                <input
                  type="radio"
                  name={`${groupId}-age`}
                  value={option.value}
                  checked={band === option.value}
                  onChange={() => {
                    setBand(option.value);
                    // Re-affirm after a change; a checkbox ticked under one age
                    // band must not carry over to another.
                    setGuardianConsent(false);
                  }}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>

        {blocked ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-hairline bg-accent-soft px-4 py-3 text-sm text-ink"
          >
            Pore is not available to people under {MIN_SUPPORTED_AGE}, so this
            scan cannot continue. No camera access was requested and nothing was
            saved.
          </div>
        ) : null}

        {band && !blocked ? (
          <div className="mt-6 space-y-4">
            {needsGuardian ? (
              <label className="flex items-start gap-3 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={guardianConsent}
                  onChange={(e) => setGuardianConsent(e.target.checked)}
                  className="mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  A parent or guardian knows I am using Pore and agrees to this
                  scan.
                </span>
              </label>
            ) : null}

            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(e) => setPhotoConsent(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0"
              />
              <span>
                I agree to take face photos for a cosmetic skin scan. They stay
                in this browser until the session expires or I delete them, and
                they are not used to train models. This is cosmetic guidance, not
                a medical diagnosis.
              </span>
            </label>

            <p className="text-xs text-ink-muted">
              Read the{" "}
              <Link href="/privacy" className="underline">
                Privacy Notice
              </Link>{" "}
              and{" "}
              <Link href="/terms" className="underline">
                Terms of Use
              </Link>
              .
            </p>
          </div>
        ) : null}

        <div className="mt-8">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={!ready}
            onClick={() => {
              if (ready) onAccept();
            }}
          >
            Continue to the scan
          </Button>
        </div>
      </Card>
    </div>
  );
}
