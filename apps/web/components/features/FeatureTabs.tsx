"use client";

import { type ReactNode, useState } from "react";
import { RoutineChecklistMock } from "../mockups/RoutineChecklistMock";
import { CompatibilityMock } from "../mockups/CompatibilityMock";
import { ProgressMock } from "../mockups/ProgressMock";
import { ProductCardMock } from "../mockups/ProductCardMock";
import { DashboardMock } from "../mockups/DashboardMock";
import { PhoneFrame } from "../mockups/PhoneFrame";
import { CameraIcon, CheckIcon } from "../ui/icons";
import { Badge } from "../ui/Badge";
import { FaceScanMock } from "../mockups/FaceScanMock";

type Tab = {
  id: string;
  label: string;
  soon?: boolean;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
};

const TABS: Tab[] = [
  {
    id: "face-photo",
    label: "Face photo",
    title: "Take a picture of your face first.",
    body: "Pore starts with a guided face photo so the routine is grounded in visible skin cues, not just a quiz about goals.",
    points: [
      "Camera-led skin check before the routine",
      "Visible cues paired with goals and preferences",
      "A clearer reason behind every recommendation",
    ],
    visual: <FaceScanMock />,
  },
  {
    id: "routines",
    label: "Personalized routines",
    title: "A routine built around your face photo.",
    body: "After your face photo and a few short questions, Pore shapes a simple AM and PM routine you can actually keep.",
    points: [
      "Simple AM / PM steps, in the right order",
      "Built from your photo, goals, and preferences",
      "A clear reason behind every step",
    ],
    visual: <RoutineChecklistMock />,
  },
  {
    id: "shelf",
    label: "Product shelf",
    title: "Your products, organized and understood.",
    body: "Add what you already own so Pore builds around your real shelf - helping you simplify instead of constantly buying more.",
    points: [
      "Catalog what you already use",
      "See ingredient highlights at a glance",
      "Spot overlap and gaps in your shelf",
    ],
    visual: <ProductCardMock />,
  },
  {
    id: "compatibility",
    label: "Ingredient compatibility",
    title: "Know what works together.",
    body: "Pore checks your actives and ingredients to help you avoid irritating combinations and unnecessary overlap.",
    points: [
      "Gentle warnings for combinations to space out",
      "Confidence that your layers make sense",
      "Education, never a diagnosis",
    ],
    visual: <CompatibilityMock />,
  },
  {
    id: "progress",
    label: "Progress tracking",
    title: "See what is actually helping.",
    body: "Log your routine and track skin changes over time with notes and photo comparisons, so you keep what works.",
    points: [
      "Consistency tracking week to week",
      "Skin notes and photo comparisons",
      "Understand which products earn their spot",
    ],
    visual: <ProgressMock />,
  },
  {
    id: "guidance",
    label: "AI guidance",
    title: "Guidance designed around your routine.",
    body: "Pore offers personalized, plain-language guidance as your skin changes - focused on routine support and ingredient education, not trends.",
    points: [
      "Personalized tips as your skin shifts",
      "Education-first, never medical claims",
      "Encourages a professional when that's the right call",
    ],
    visual: <DashboardMock />,
  },
  {
    id: "mobile",
    label: "Mobile access",
    soon: true,
    title: "Pore is coming with you.",
    body: "Start on the web today. Mobile access is on the way so you can follow and log your routine wherever life takes you.",
    points: [
      "Web app available first",
      "Mobile coming soon",
      "Your routine, in sync",
    ],
    visual: (
      <PhoneFrame>
        <RoutineChecklistMock
          compact
          className="max-w-none border-0 shadow-none"
        />
      </PhoneFrame>
    ),
  },
];

export function FeatureTabs() {
  const [active, setActive] = useState(0);
  const tab = TABS[active];

  return (
    <div>
      {/* tab bar */}
      <div className="flex flex-wrap justify-center gap-2">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActive(i)}
            className={`inline-flex items-center gap-2 rounded-pill px-4 py-2 text-sm font-medium transition-all ${
              i === active
                ? "bg-primary text-on-primary shadow-[var(--shadow-card)]"
                : "border border-hairline bg-surface text-ink-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.soon ? (
              <span
                className={`rounded-pill px-1.5 py-0.5 text-[9px] font-semibold uppercase ${
                  i === active ? "bg-on-primary/20" : "bg-canvas text-ink-muted"
                }`}
              >
                Soon
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* panel */}
      <div className="mt-10 grid items-center gap-10 rounded-[28px] border border-hairline bg-surface p-7 sm:p-10 lg:grid-cols-2">
        <div>
          {tab.soon ? <Badge tone="soon">Coming soon</Badge> : null}
          <h3 className="mt-3 font-display text-2xl leading-tight text-ink sm:text-3xl">
            {tab.title}
          </h3>
          <p className="mt-3 text-base leading-relaxed text-ink-muted">
            {tab.body}
          </p>
          <ul className="mt-6 space-y-3">
            {tab.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5 text-sm text-ink">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  {tab.id === "face-photo" ? (
                    <CameraIcon size={12} />
                  ) : (
                    <CheckIcon size={12} />
                  )}
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">{tab.visual}</div>
      </div>
    </div>
  );
}
