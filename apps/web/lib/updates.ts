/** Product updates feed ("Built in public"). Structured so it can later be
 *  backed by a CMS or database without touching the UI. */

export type UpdateStatus = "live" | "soon";

export type ProductUpdate = {
  id: string;
  date: string;
  status: UpdateStatus;
  title: string;
  body: string;
};

export const PRODUCT_UPDATES: ProductUpdate[] = [
  {
    id: "waitlist-open",
    date: "June 2026",
    status: "live",
    title: "Pore Waitlist Is Open",
    body: "Be among the first to experience personalized skincare guidance built around your skin, products, and goals.",
  },
  {
    id: "compatibility-engine",
    date: "Coming soon",
    status: "soon",
    title: "Routine Compatibility Engine",
    body: "A clearer way to understand whether your skincare products work well together — before you layer them.",
  },
  {
    id: "progress-tracking",
    date: "Coming soon",
    status: "soon",
    title: "Skin Progress Tracking",
    body: "Track your consistency, notes, and visible changes over time so you can see what's actually helping.",
  },
];
