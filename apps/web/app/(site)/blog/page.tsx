import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/sections/PageHero";
import { Section } from "@/components/ui/Section";
import { Reveal } from "@/components/ui/Reveal";
import { Badge } from "@/components/ui/Badge";
import { BlogSearch } from "@/components/blog/BlogSearch";
import { CoverArt } from "@/components/blog/CoverArt";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ArrowIcon } from "@/components/ui/icons";
import { ARTICLES, getFeaturedArticle } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Skincare, explained clearly — routine building, ingredients, skin goals, product education, and Pore updates.",
};

export default function BlogPage() {
  const featured = getFeaturedArticle();
  const rest = ARTICLES.filter((a) => a.slug !== featured.slug);

  return (
    <>
      <PageHero
        eyebrow="The Pore Blog"
        title="Skincare, explained clearly."
        lede="Plain-language guidance on routine building, ingredients, skin goals, and product education — no hype, no 12-step pressure."
      />

      {/* featured */}
      <Section tone="canvas" className="pt-0 sm:pt-0">
        <Reveal>
          <Link
            href={`/blog/${featured.slug}`}
            className="group grid overflow-hidden rounded-[28px] border border-hairline bg-surface shadow-[var(--shadow-card)] transition-all duration-300 hover:shadow-[var(--shadow-lift)] lg:grid-cols-2"
          >
            <CoverArt tone={featured.tone} aspect="aspect-[16/10] lg:aspect-auto lg:h-full" />
            <div className="flex flex-col justify-center p-7 sm:p-10">
              <div className="flex items-center gap-2">
                <Badge tone="primary">Featured</Badge>
                <Badge tone="lavender">{featured.category}</Badge>
                <span className="text-[11px] text-ink-muted">
                  {featured.readTime}
                </span>
              </div>
              <h2 className="mt-4 font-display text-2xl leading-snug text-ink sm:text-3xl">
                {featured.title}
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-ink-muted">
                {featured.excerpt}
              </p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Read article
                <ArrowIcon
                  size={16}
                  className="transition-transform duration-200 group-hover:translate-x-1"
                />
              </span>
            </div>
          </Link>
        </Reveal>
      </Section>

      {/* search + grid */}
      <Section tone="surface" className="pt-0 sm:pt-0">
        <BlogSearch articles={rest} />
      </Section>

      <FinalCTA
        title="Get skincare clarity in your inbox."
        body="Join the Pore waitlist for new articles, product updates, and first access to new features."
      />
    </>
  );
}
