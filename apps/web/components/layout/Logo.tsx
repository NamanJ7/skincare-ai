import Image from "next/image";
import Link from "next/link";

export function Logo({
  markOnly = false,
  invert = false,
  className = "",
  href = "/",
}: {
  markOnly?: boolean;
  invert?: boolean;
  className?: string;
  href?: string | null;
}) {
  const inkClass = invert ? "text-on-primary" : "text-ink";

  const content = (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/logo-mark-nav.png"
        alt=""
        width={26}
        height={40}
        className={`h-9 w-auto shrink-0 sm:h-10 ${
          invert ? "brightness-0 invert" : ""
        }`}
        priority
        unoptimized
      />
      {markOnly ? null : (
        <span
          className={`font-display text-xl font-semibold tracking-tight ${inkClass}`}
        >
          Pore
        </span>
      )}
    </span>
  );

  if (href === null) return content;

  return (
    <Link href={href} aria-label="Pore — home" className="inline-flex">
      {content}
    </Link>
  );
}
