import { CameraIcon, CheckIcon, SparkleIcon } from "../ui/icons";

export function FaceScanMock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`w-full max-w-sm overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] ${className}`}
    >
      <div className="flex items-center justify-between border-b border-hairline bg-canvas/60 px-5 py-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
            Face photo
          </p>
          <h4 className="mt-1 font-display text-lg leading-none text-ink">
            Guided skin check
          </h4>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-on-primary">
          <CameraIcon size={18} />
        </span>
      </div>

      <div className="p-5">
        <div className="relative mx-auto aspect-[4/5] w-full max-w-[240px] overflow-hidden rounded-2xl border border-[#e4dcf3] bg-accent-soft">
          <div className="absolute inset-3 rounded-[22px] border border-dashed border-primary/35" />
          <div className="absolute left-1/2 top-9 h-20 w-20 -translate-x-1/2 rounded-full bg-[#dfb8a8]" />
          <div className="absolute left-1/2 top-[112px] h-24 w-32 -translate-x-1/2 rounded-t-[52px] bg-[#dfb8a8]" />
          <div className="absolute left-1/2 top-[72px] h-2 w-10 -translate-x-1/2 rounded-full bg-[#6f5146]/35" />
          <span className="absolute left-8 top-12 h-3 w-3 rounded-full border-2 border-primary bg-surface" />
          <span className="absolute right-10 top-24 h-3 w-3 rounded-full border-2 border-primary bg-surface" />
          <span className="absolute bottom-16 left-12 h-3 w-3 rounded-full border-2 border-primary bg-surface" />
          <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-surface/90 px-3 py-2 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <SparkleIcon size={13} />
              Visible areas mapped
            </div>
            <p className="mt-1 text-[11px] leading-snug text-ink-muted">
              Breakouts, texture, tone, and dryness cues guide your plan.
            </p>
          </div>
        </div>

        <ul className="mt-4 space-y-2 text-sm text-ink">
          {["Take a clear face photo", "Add goals and products", "Get routine guidance"].map(
            (item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon size={12} />
                </span>
                {item}
              </li>
            ),
          )}
        </ul>
      </div>
    </div>
  );
}
