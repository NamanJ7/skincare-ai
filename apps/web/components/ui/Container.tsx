import { type ReactNode } from "react";

/** Centered max-width wrapper (~1180px) used across every section. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full max-w-[1180px] px-5 sm:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
