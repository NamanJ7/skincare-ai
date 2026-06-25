import Link from "next/link";
import { type Article } from "@/lib/blog";
import { Badge } from "../ui/Badge";
import { CoverArt } from "./CoverArt";
import { ArrowIcon } from "../ui/icons";

export function ArticleCard({ article }: { article: Article }) {
  return (
    <Link
      href={`/blog/${article.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-hairline bg-surface shadow-[var(--shadow-card)] transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1.5 hover:shadow-[var(--shadow-lift)]"
    >
      <CoverArt tone={article.tone} />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2">
          <Badge tone="lavender">{article.category}</Badge>
          <span className="text-[11px] text-ink-muted">{article.readTime}</span>
        </div>
        <h3 className="mt-3 font-display text-lg leading-snug text-ink">
          {article.title}
        </h3>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
          {article.excerpt}
        </p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
          Read more
          <ArrowIcon
            size={16}
            className="transition-transform duration-200 group-hover:translate-x-1"
          />
        </span>
      </div>
    </Link>
  );
}
