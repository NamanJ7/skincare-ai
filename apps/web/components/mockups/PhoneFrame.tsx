import { type ReactNode } from "react";

/** A lightweight phone bezel for supporting mobile previews. */
export function PhoneFrame({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`relative w-[208px] rounded-[34px] border border-hairline bg-ink/90 p-2 shadow-[var(--shadow-lift)] ${className}`}
    >
      <div className="relative overflow-hidden rounded-[26px] bg-canvas">
        {/* notch */}
        <div className="absolute left-1/2 top-2 z-10 h-4 w-16 -translate-x-1/2 rounded-pill bg-ink/90" />
        <div className="min-h-[420px] px-4 pb-5 pt-9">{children}</div>
      </div>
    </div>
  );
}
