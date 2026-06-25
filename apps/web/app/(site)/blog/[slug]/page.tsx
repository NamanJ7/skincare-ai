import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Section } from "@/components/ui/Section";
import { Badge } from "@/components/ui/Badge";
import { Reveal } from "@/components/ui/Reveal";
import { CoverArt } from "@/components/blog/CoverArt";
import { RichText } from "@/components/blog/RichText";
import { ArticleCard } from "@/components/blog/ArticleCard";
import { FinalCTA } from "@/components/sections/FinalCTA";
import { ArrowIcon } from "@/components/ui/icons";
import { getArticle, getRelatedArticles } from "@/lib/blog";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Article not found" };
  return { title: article.title, description: article.excerpt };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const related = getRelatedArticles(slug);

  return (
    <>
      <article>
        {/* header */}
        <Section tone="canvas" className="pb-0 sm:pb-0">
          <div className="mx-auto max-w-3xl">
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              <ArrowIcon size={16} className="rotate-180" />
              Back to blog
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <Badge tone="lavender">{article.category}</Badge>
              <span className="text-sm text-ink-muted">{article.readTime}</span>
            </div>
            <h1 className="mt-4 font-display text-3xl leading-[1.1] text-ink sm:text-4xl lg:text-5xl">
              {article.title}
            </h1>
            <p className="mt-4 text-sm text-ink-muted">
              {article.author} · {article.date}
            </p>
          </div>
        </Section>

        {/* cover */}
        <Container>
          <Reveal className="mx-auto mt-8 max-w-3xl">
            <CoverArt
              tone={article.tone}
              aspect="aspect-[16/8]"
              className="rounded-[28px] border border-hairline"
            />
          </Reveal>
        </Container>

        {/* body */}
        <Section tone="canvas" className="pt-10 sm:pt-12">
          <div className="mx-auto max-w-3xl">
            <RichText blocks={article.body} />

            <p className="mt-12 rounded-2xl border border-hairline bg-surface px-5 py-4 text-xs leading-relaxed text-ink-muted">
              {MEDICAL_DISCLAIMER}
            </p>
          </div>
        </Section>
      </article>

      {/* related */}
      {related.length > 0 ? (
        <Section tone="surface">
          <div className="mx-auto max-w-5xl">
            <h2 className="font-display text-2xl text-ink">Keep reading</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {related.map((a) => (
                <ArticleCard key={a.slug} article={a} />
              ))}
            </div>
          </div>
        </Section>
      ) : null}

      <FinalCTA />
    </>
  );
}
