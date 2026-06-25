/** Blog content. Authored as typed content blocks (no MDX tooling) so it stays
 *  reliable on Next 16 / Turbopack and trivially maps to a CMS later.
 *  Render bodies with components/blog/RichText.tsx. */

export type BlogCategory =
  | "Routine Building"
  | "Ingredients"
  | "Skin Goals"
  | "Product Education"
  | "Pore Updates";

export const BLOG_CATEGORIES: BlogCategory[] = [
  "Routine Building",
  "Ingredients",
  "Skin Goals",
  "Product Education",
  "Pore Updates",
];

/** Coded cover tone (we render gradient covers, not photos). */
export type CoverTone = "cream" | "lavender" | "green";

export type Block =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; text: string }
  | { type: "quote"; text: string };

export type Article = {
  slug: string;
  title: string;
  category: BlogCategory;
  readTime: string;
  excerpt: string;
  tone: CoverTone;
  author: string;
  date: string;
  featured?: boolean;
  body: Block[];
};

export const ARTICLES: Article[] = [
  {
    slug: "why-your-routine-stopped-working",
    title: "Why Your Skincare Routine Worked for a Month, Then Stopped",
    category: "Routine Building",
    readTime: "5 min read",
    excerpt:
      "That early glow-up is real — and so is the plateau that follows. Here's what's usually happening, and how to adjust without starting over.",
    tone: "lavender",
    author: "The Pore Team",
    date: "June 18, 2026",
    featured: true,
    body: [
      {
        type: "paragraph",
        text: "You start a new routine and, for a few weeks, your skin looks noticeably better. Then the progress quietly stalls. It can feel like the products stopped working — but more often, your skin simply adjusted, and your routine didn't move with it.",
      },
      { type: "heading", text: "The honeymoon effect is real" },
      {
        type: "paragraph",
        text: "When you first add hydration, gentle exfoliation, or sunscreen, you're often correcting obvious gaps. Those early wins are the easy ones. Once they're handled, your skin needs a slightly different kind of support to keep improving — not more products, just better-matched ones.",
      },
      {
        type: "callout",
        text: "A plateau is usually a signal to refine your routine, not to overhaul it.",
      },
      { type: "heading", text: "Common reasons progress stalls" },
      {
        type: "list",
        items: [
          "Consistency slipped — skipping steps a few nights a week adds up fast.",
          "You ramped an active too quickly and your skin is quietly irritated.",
          "Seasonal change shifted what your skin needs (more hydration in winter, lighter textures in summer).",
          "You kept stacking new products instead of giving one change time to show results.",
        ],
      },
      { type: "heading", text: "How to move past the plateau" },
      {
        type: "paragraph",
        text: "Change one thing at a time and give it two to four weeks. Track how your skin responds so you're adjusting from evidence, not guesswork. Often the fix is subtraction — simplifying an overloaded routine so the steps that matter can actually do their job.",
      },
      {
        type: "quote",
        text: "Your skin does not need a 12-step routine. It needs the right routine.",
      },
      {
        type: "paragraph",
        text: "This is exactly the kind of adjustment Pore is built to help with: a clear routine, a simple way to log it, and guidance that evolves as your skin does.",
      },
    ],
  },
  {
    slug: "ingredients-to-avoid-layering",
    title: "What Ingredients Should You Avoid Layering Together?",
    category: "Ingredients",
    readTime: "6 min read",
    excerpt:
      "Not every active plays nicely with the next. A plain-language guide to the combinations worth spacing out — and why.",
    tone: "green",
    author: "The Pore Team",
    date: "June 11, 2026",
    body: [
      {
        type: "paragraph",
        text: "Layering actives isn't about memorizing a forbidden list — it's about understanding why some combinations can leave skin irritated, and how to space them out so each one can work.",
      },
      { type: "heading", text: "Combinations worth spacing out" },
      {
        type: "list",
        items: [
          "Two strong acids in the same routine — pick one exfoliating active per night rather than stacking them.",
          "A retinoid plus a strong exfoliating acid at the same time — many people do better alternating nights.",
          "Several brand-new actives introduced all at once — your skin can't tell you which one it disliked.",
        ],
      },
      {
        type: "callout",
        text: "Irritation is rarely about one 'bad' product — it's usually about too much, too fast, too close together.",
      },
      { type: "heading", text: "Ingredients that generally get along" },
      {
        type: "paragraph",
        text: "Plenty of pairings are friendly: hydrating ingredients like hyaluronic acid and ceramides support almost any routine, and niacinamide is famously easy-going. The goal isn't fewer ingredients for its own sake — it's a routine where the steps complement each other.",
      },
      { type: "heading", text: "A simple rule of thumb" },
      {
        type: "paragraph",
        text: "Introduce one active at a time, keep your strongest treatments on separate evenings if your skin is sensitive, and always pair active routines with daily sunscreen. When in doubt, simplify.",
      },
      {
        type: "paragraph",
        text: "Pore's compatibility view does this checking for you — flagging overlap and gentle warnings so you can avoid combinations that tend to irritate, without the spreadsheet.",
      },
    ],
  },
  {
    slug: "build-a-routine-without-overcomplicating",
    title: "How to Build a Routine Without Overcomplicating Your Skin",
    category: "Routine Building",
    readTime: "4 min read",
    excerpt:
      "A short, sturdy routine you'll actually keep beats an elaborate one you abandon. Here's a simple framework to start from.",
    tone: "cream",
    author: "The Pore Team",
    date: "June 4, 2026",
    body: [
      {
        type: "paragraph",
        text: "The best routine is the one you'll actually follow. Before adding anything fancy, get the foundation right — most skin does beautifully on a handful of well-chosen steps.",
      },
      { type: "heading", text: "The core four" },
      {
        type: "list",
        items: [
          "A gentle cleanser to start clean morning and night.",
          "A moisturizer suited to your skin type to support the barrier.",
          "Daily sunscreen in the morning — the single highest-impact step.",
          "One targeted treatment for your main goal, added once the basics feel easy.",
        ],
      },
      {
        type: "callout",
        text: "Start with what you'll keep. You can always add — but consistency is what actually moves the needle.",
      },
      { type: "heading", text: "Add slowly, and on purpose" },
      {
        type: "paragraph",
        text: "Once your core routine feels effortless, introduce one targeted active and give it a few weeks. Note how your skin responds before changing anything else. This patience is what separates routines that compound from routines that constantly reset.",
      },
      {
        type: "quote",
        text: "Simplify your shelf instead of constantly adding to it.",
      },
      {
        type: "paragraph",
        text: "Pore builds this kind of simple AM/PM routine around your skin, your goals, and the products you already own — then helps you track it so you can keep what's working.",
      },
    ],
  },
];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getFeaturedArticle(): Article {
  return ARTICLES.find((a) => a.featured) ?? ARTICLES[0];
}

export function getRelatedArticles(slug: string, limit = 2): Article[] {
  return ARTICLES.filter((a) => a.slug !== slug).slice(0, limit);
}
