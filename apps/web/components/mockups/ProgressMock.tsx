import { CameraIcon } from "../ui/icons";

/** Feature 3 — Track Your Progress: consistency + notes + photo comparison. */
export function ProgressMock({ className = "" }: { className?: string }) {
  const weeks = [60, 72, 68, 84, 90, 96];
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-base text-ink">Your progress</p>
        <span className="text-[11px] font-medium text-primary">6 weeks</span>
      </div>

      {/* consistency bars */}
      <div className="mt-4 flex items-end gap-2">
        {weeks.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-20 w-full items-end rounded-md bg-canvas/60">
              <div
                className="w-full rounded-md bg-primary/85"
                style={{ height: `${h}%` }}
              />
            </div>
            <span className="text-[9px] text-ink-muted">W{i + 1}</span>
          </div>
        ))}
      </div>

      {/* photo comparison */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        {[
          { label: "Week 1", from: "#efe6d8", to: "#e4d6c2" },
          { label: "Week 6", from: "#eef0e9", to: "#dfe7dd" },
        ].map((p) => (
          <div
            key={p.label}
            className="overflow-hidden rounded-xl border border-hairline"
          >
            <div
              className="flex h-20 items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
              }}
            >
              <CameraIcon size={18} className="text-ink/30" />
            </div>
            <p className="bg-surface px-2 py-1 text-[10px] font-medium text-ink-muted">
              {p.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-3 rounded-xl bg-accent-soft px-3 py-2 text-[11px] text-accent-ink">
        <span className="font-semibold">Note:</span> breakouts calmer, tone more
        even since week 3.
      </div>
    </div>
  );
}
