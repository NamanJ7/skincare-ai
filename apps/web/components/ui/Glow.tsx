/** Soft radial brand glow placed behind hero art / mockups. Purely decorative. */
export function Glow({
  tone = "lavender",
  className = "",
  size = 420,
  animate = true,
}: {
  tone?: "lavender" | "green" | "gold";
  className?: string;
  size?: number;
  animate?: boolean;
}) {
  const color =
    tone === "green"
      ? "rgba(50,72,63,0.22)"
      : tone === "gold"
        ? "rgba(182,160,126,0.28)"
        : "rgba(230,224,242,0.85)";

  return (
    <div
      aria-hidden
      className={`glow-blur absolute -z-10 ${animate ? "animate-glow" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color} 0%, transparent 70%)`,
      }}
    />
  );
}
