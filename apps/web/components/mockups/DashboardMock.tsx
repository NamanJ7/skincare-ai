import {
  CheckIcon,
  DropIcon,
  SunIcon,
  MoonIcon,
  SparkleIcon,
} from "../ui/icons";

/** The primary hero visual: a browser-framed Pore web dashboard ("Today").
 *  Pure presentation, on-brand via Tailwind tokens. */
export function DashboardMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-lift)] ${className}`}
    >
      {/* browser chrome */}
      <div className="flex items-center gap-2 border-b border-hairline bg-canvas/70 px-4 py-3">
        <span className="h-3 w-3 rounded-full bg-[#E2C2BA]" />
        <span className="h-3 w-3 rounded-full bg-[#E6D6B4]" />
        <span className="h-3 w-3 rounded-full bg-[#BFD3C6]" />
        <div className="mx-auto flex items-center gap-2 rounded-pill border border-hairline bg-surface px-4 py-1 text-[11px] text-ink-muted">
          <DropIcon size={12} className="text-primary" />
          app.pore.skin
        </div>
      </div>

      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[180px_1fr]">
        {/* sidebar */}
        <aside className="border-r border-hairline bg-canvas/50 px-3 py-5 sm:px-4">
          <div className="hidden items-center gap-2 sm:flex">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary text-on-primary">
              <DropIcon size={15} />
            </span>
            <span className="font-display text-sm font-semibold">Pore</span>
          </div>
          <nav className="mt-6 space-y-1.5">
            {[
              { label: "Today", active: true },
              { label: "Plan", active: false },
              { label: "Progress", active: false },
              { label: "Compare", active: false },
            ].map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2 rounded-lg px-2 py-2 text-xs font-medium ${
                  item.active
                    ? "bg-primary/10 text-primary"
                    : "text-ink-muted"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    item.active ? "bg-primary" : "bg-hairline"
                  }`}
                />
                <span className="hidden sm:inline">{item.label}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* main */}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                Tuesday · Morning
              </p>
              <h3 className="mt-1 font-display text-xl text-ink sm:text-2xl">
                Good morning, Maya
              </h3>
            </div>
            <ConsistencyRing value={92} />
          </div>

          {/* AM / PM tabs */}
          <div className="mt-5 inline-flex rounded-pill border border-hairline bg-canvas p-1 text-xs font-semibold">
            <span className="inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1.5 text-primary shadow-sm">
              <SunIcon size={13} /> AM
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-ink-muted">
              <MoonIcon size={13} /> PM
            </span>
          </div>

          {/* checklist */}
          <ul className="mt-4 space-y-2.5">
            <Step done label="Gentle gel cleanser" note="Step 1 · Cleanse" />
            <Step done label="Vitamin C serum" note="Step 2 · Treat" />
            <Step label="Oil-free moisturizer" note="Step 3 · Hydrate" />
            <Step label="SPF 50 sunscreen" note="Step 4 · Protect" highlight />
          </ul>

          <div className="mt-5 flex items-center gap-2 rounded-lg border border-[#e4dcf3] bg-accent-soft px-3 py-2.5">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-accent-ink">
              <SparkleIcon size={14} />
            </span>
            <p className="text-xs leading-snug text-accent-ink">
              <span className="font-semibold">Tip:</span> space your exfoliant to
              PM tonight — you used vitamin C this morning.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({
  label,
  note,
  done = false,
  highlight = false,
}: {
  label: string;
  note: string;
  done?: boolean;
  highlight?: boolean;
}) {
  return (
    <li
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${
        highlight ? "border-primary/30 bg-primary/5" : "border-hairline bg-surface"
      }`}
    >
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${
          done
            ? "bg-primary text-on-primary"
            : "border border-hairline bg-canvas text-transparent"
        }`}
      >
        <CheckIcon size={14} />
      </span>
      <div className="min-w-0">
        <p
          className={`truncate text-sm font-medium ${
            done ? "text-ink-muted line-through" : "text-ink"
          }`}
        >
          {label}
        </p>
        <p className="text-[11px] text-ink-muted">{note}</p>
      </div>
    </li>
  );
}

function ConsistencyRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative grid h-16 w-16 place-items-center">
      <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="#E7E0D4" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke="#32483F"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <span className="font-display text-sm font-semibold text-ink">{value}%</span>
      </div>
    </div>
  );
}
