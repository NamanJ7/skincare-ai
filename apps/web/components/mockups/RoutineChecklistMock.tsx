import { CheckIcon, SunIcon, MoonIcon } from "../ui/icons";

/** Feature 1 — Personalized Routine Builder: AM/PM checklist dashboard. */
export function RoutineChecklistMock({
  className = "",
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] ${
        compact ? "p-3" : "p-5"
      } ${className}`}
    >
      <div
        className={
          compact
            ? "flex flex-col items-start gap-2"
            : "flex items-center justify-between"
        }
      >
        <p className={`font-display text-ink ${compact ? "text-sm" : "text-base"}`}>
          Your routine
        </p>
        <div
          className={`inline-flex rounded-pill border border-hairline bg-canvas p-0.5 font-semibold ${
            compact ? "text-[10px]" : "text-[11px]"
          }`}
        >
          <span
            className={`inline-flex items-center gap-1 rounded-pill bg-primary text-on-primary ${
              compact ? "px-2 py-0.5" : "px-2.5 py-1"
            }`}
          >
            <SunIcon size={12} /> Morning
          </span>
          <span
            className={`inline-flex items-center gap-1 text-ink-muted ${
              compact ? "px-2 py-0.5" : "px-2.5 py-1"
            }`}
          >
            <MoonIcon size={12} /> Night
          </span>
        </div>
      </div>

      <ul className={compact ? "mt-3 space-y-1.5" : "mt-4 space-y-2"}>
        {[
          { t: "Gentle cleanser", s: "Cleanse", done: true },
          { t: "Niacinamide serum", s: "Treat", done: true },
          { t: "Ceramide moisturizer", s: "Hydrate", done: false },
          { t: "SPF 50", s: "Protect", done: false },
        ].map((row) => (
          <li
            key={row.t}
            className={`flex items-center rounded-xl border border-hairline bg-canvas/40 ${
              compact ? "gap-2 px-2.5 py-2" : "gap-3 px-3 py-2.5"
            }`}
          >
            <span
              className={`grid shrink-0 place-items-center rounded-full ${
                compact ? "h-5 w-5" : "h-6 w-6"
              } ${
                row.done
                  ? "bg-primary text-on-primary"
                  : "border border-hairline bg-surface text-transparent"
              }`}
            >
              <CheckIcon size={13} />
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={`font-medium leading-snug text-ink ${
                  compact ? "text-xs" : "text-sm"
                }`}
              >
                {row.t}
              </p>
              <p className="text-[11px] text-ink-muted">{row.s}</p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className={`mt-4 flex items-center justify-between gap-3 rounded-xl bg-accent-soft ${
          compact ? "px-2.5 py-2" : "px-3 py-2.5"
        }`}
      >
        <span className="text-xs font-medium text-accent-ink">2 of 4 done</span>
        <div
          className={`h-1.5 overflow-hidden rounded-pill bg-surface ${
            compact ? "w-14" : "w-24"
          }`}
        >
          <div className="h-full w-1/2 rounded-pill bg-primary" />
        </div>
      </div>
    </div>
  );
}
