"use client";

/**
 * Shown on the intro when a saved draft exists on this device.
 */
import { Card } from "@/components/ui/Card";
import type { ScanDraft } from "@/lib/scan/scan-store";

export function ResumeBanner({
  draft,
  onResume,
  onDiscard,
}: {
  draft: ScanDraft;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const when = new Date(draft.savedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return (
    <Card tone="lavender" className="!p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          <span className="font-semibold text-accent-ink">Saved scan</span>{" "}
          <span className="text-ink-muted">
            · {draft.shots.length} of 3 photos · {when} · stays on this device
          </span>
        </p>
        <div className="flex gap-2">
          <button
            onClick={onResume}
            className="rounded-pill bg-primary px-4 py-1.5 text-sm font-semibold !text-on-primary transition-colors hover:bg-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Resume
          </button>
          <button
            onClick={onDiscard}
            className="rounded-pill px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            Start over
          </button>
        </div>
      </div>
    </Card>
  );
}
