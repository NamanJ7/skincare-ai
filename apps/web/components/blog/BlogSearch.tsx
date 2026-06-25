"use client";

import { useMemo, useState } from "react";
import { type Article, BLOG_CATEGORIES } from "@/lib/blog";
import { ArticleCard } from "./ArticleCard";
import { SearchIcon } from "../ui/icons";

const FILTERS = ["All", ...BLOG_CATEGORIES] as const;

export function BlogSearch({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof FILTERS)[number]>("All");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return articles.filter((a) => {
      const matchesCategory = category === "All" || a.category === category;
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.excerpt.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [articles, query, category]);

  return (
    <div>
      {/* search */}
      <div className="mx-auto flex max-w-lg items-center gap-2 rounded-pill border border-hairline bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
        <SearchIcon size={18} className="text-ink-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search articles…"
          className="w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
        />
      </div>

      {/* category chips */}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setCategory(f)}
            className={`rounded-pill px-3.5 py-1.5 text-sm font-medium transition-all ${
              category === f
                ? "bg-primary text-on-primary"
                : "border border-hairline bg-surface text-ink-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* grid */}
      {filtered.length > 0 ? (
        <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <ArticleCard key={a.slug} article={a} />
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-sm text-ink-muted">
          No articles match your search yet.
        </p>
      )}
    </div>
  );
}
