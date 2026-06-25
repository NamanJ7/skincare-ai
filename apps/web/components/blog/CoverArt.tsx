import { type CoverTone } from "@/lib/blog";
import { DropIcon } from "../ui/icons";

const tones: Record<CoverTone, string> = {
  cream: "linear-gradient(135deg,#f3ece0,#e9dcc8)",
  lavender: "linear-gradient(135deg,#efeaf8,#e0d8f1)",
  green: "linear-gradient(135deg,#e7ede8,#d4e0d8)",
};

const iconColor: Record<CoverTone, string> = {
  cream: "text-[#b6a07e]",
  lavender: "text-accent-ink",
  green: "text-primary",
};

/** Coded gradient cover for blog cards/articles (no photography). */
export function CoverArt({
  tone,
  className = "",
  aspect = "aspect-[16/10]",
}: {
  tone: CoverTone;
  className?: string;
  aspect?: string;
}) {
  return (
    <div
      className={`relative ${aspect} w-full overflow-hidden ${className}`}
      style={{ background: tones[tone] }}
    >
      <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/25 blur-xl" />
      <div className="absolute bottom-3 left-3">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl bg-white/70 ${iconColor[tone]}`}
        >
          <DropIcon size={18} />
        </span>
      </div>
    </div>
  );
}
