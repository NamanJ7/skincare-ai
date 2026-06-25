import { type Block } from "@/lib/blog";

/** Renders a typed Block[] article body. Swap-friendly for a CMS later. */
export function RichText({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <h2
                key={i}
                className="pt-2 font-display text-2xl leading-snug text-ink"
              >
                {block.text}
              </h2>
            );
          case "paragraph":
            return (
              <p key={i} className="text-lg leading-relaxed text-ink/90">
                {block.text}
              </p>
            );
          case "list":
            return (
              <ul key={i} className="space-y-2.5 pl-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-lg text-ink/90">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            );
          case "callout":
            return (
              <div
                key={i}
                className="rounded-2xl border border-[#e4dcf3] bg-accent-soft px-5 py-4 text-base leading-relaxed text-accent-ink"
              >
                {block.text}
              </div>
            );
          case "quote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary pl-5 font-display text-xl italic leading-snug text-ink"
              >
                {block.text}
              </blockquote>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
