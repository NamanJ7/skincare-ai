import { CheckIcon, AlertIcon } from "../ui/icons";

/** Feature 2 — Ingredient Compatibility: pairs with checks + gentle warnings. */
export function CompatibilityMock({ className = "" }: { className?: string }) {
  const rows = [
    { a: "Niacinamide", b: "Hyaluronic acid", ok: true, note: "Works well together" },
    { a: "Vitamin C", b: "SPF", ok: true, note: "Great morning pair" },
    { a: "Retinoid", b: "Glycolic acid", ok: false, note: "Space to alternate nights" },
  ];
  return (
    <div
      className={`w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-base text-ink">Compatibility check</p>
        <span className="inline-flex items-center gap-1 rounded-pill bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
          <CheckIcon size={12} /> 2 safe
        </span>
      </div>

      <ul className="mt-4 space-y-2.5">
        {rows.map((row) => (
          <li
            key={`${row.a}-${row.b}`}
            className={`rounded-xl border px-3 py-3 ${
              row.ok
                ? "border-hairline bg-canvas/40"
                : "border-[#ecd6bf] bg-[#fbf3e6]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-ink">{row.a}</span>
              <span className="text-xs text-ink-muted">+</span>
              <span className="text-sm font-medium text-ink">{row.b}</span>
              <span
                className={`ml-auto grid h-6 w-6 place-items-center rounded-full ${
                  row.ok
                    ? "bg-primary text-on-primary"
                    : "bg-caution/15 text-caution"
                }`}
              >
                {row.ok ? <CheckIcon size={13} /> : <AlertIcon size={13} />}
              </span>
            </div>
            <p
              className={`mt-1 text-[11px] ${
                row.ok ? "text-ink-muted" : "text-[#9a6b2a]"
              }`}
            >
              {row.note}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
