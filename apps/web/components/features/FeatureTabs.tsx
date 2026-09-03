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
    label: "Guided capture",
    title: "Three guided photos, not one.",
    body: "Straight on and each side, lit by your own screen so every set is shot under the same known light and can be compared to the next one weeks later.",
    points: [
      "Each frame measured for focus and exposure before it counts",
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
    id: "pacing",
    label: "Pacing",
    title: "You never plan a night yourself.",
    body: "Strong actives open at one use a week and build over six. Pore spaces them so two never land on the same day, and shows you only the session in front of you.",
    points: [
      "One strong active a day, never two",
      "Rest nights are placed on purpose, not missing",
      "Say your skin stung and it pulls them for three days",
    ],
    visual: <ProductCardMock />,
  },
  {
    id: "compatibility",
    label: "Ingredient safety",
    title: "The rules are code, not a prompt.",
    body: "A model drafts the routine; a deterministic engine has the final say. Sunscreen is always in your morning, anything you have reacted to is removed outright, and pregnancy-unsafe ingredients are stripped whatever the model returned.",
    points: [
      "Two strong exfoliants never share a session",
      "How reactive your skin is caps the whole routine",
      "Every change comes with the reason it was made",
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
    label: "On your phone",
    soon: true,
    title: "Pore is a phone app, by necessity.",
    body: "The capture uses your screen as a controlled light source, so every set is comparable to the last. That only works on a phone — and it means your photos and your record can stay on the device.",
    points: [
      "Your screen is the light source",
      "Photos and record never leave the phone",
      "Not on the app stores yet — join the waitlist",
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
