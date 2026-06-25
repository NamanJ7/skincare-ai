import { CheckIcon, DropIcon } from "../ui/icons";

/** Feature 4 — Smarter Product Guidance: product with fit score + highlights. */
export function ProductCardMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-16 w-12 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-[#eef0e9] to-[#dfe7dd]">
          <DropIcon size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Niacinamide 10% Serum</p>
          <p className="text-[11px] text-ink-muted">Oil control · Even tone</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["Niacinamide", "Zinc", "Fragrance-free"].map((tag) => (
              <span
                key={tag}
                className="rounded-pill bg-canvas px-2 py-0.5 text-[10px] font-medium text-ink-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* fit score */}
      <div className="mt-4 rounded-xl border border-hairline bg-canvas/40 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-ink-muted">
            Routine fit score
          </span>
          <span className="font-display text-sm font-semibold text-primary">
            94
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-pill bg-surface">
          <div className="h-full w-[94%] rounded-pill bg-primary" />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2.5">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary">
          <CheckIcon size={13} />
        </span>
        <p className="text-xs font-medium text-primary">
          Works well with your routine
        </p>
      </div>
    </div>
  );
}
