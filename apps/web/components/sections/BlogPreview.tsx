import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Button } from "../ui/Button";
import { ArticleCard } from "../blog/ArticleCard";
import { ARTICLES } from "@/lib/blog";

export function BlogPreview() {
  const articles = ARTICLES.slice(0, 3);
  return (
    <Section id="blog" tone="surface">
      <Reveal>
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="From the blog"
            title="Skincare, explained clearly."
          />
          <Button href="/blog" variant="secondary" size="md">
            Visit the blog
          </Button>
        </div>
      </Reveal>

      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {articles.map((a, i) => (
          <Reveal key={a.slug} delay={i * 80}>
            <ArticleCard article={a} />
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
