/**
 * The one thing Home asks of the user right now. A pure priority ladder —
 * today's routine comes first, followed by a due weekly comparison, an
 * optional skin-feel check-in, then the shelf. One action at a time keeps Home
 * calm and makes the first session lead to action instead of more setup.
 * (Escalation outranks all of this, but Home renders EscalationCard in the
 * slot directly rather than routing it through here.)
 */
import type { Routine } from "@pore/shared";

import {
  periodComplete,
  routineStepInstances,
  type DayLog,
  type RoutinePeriod,
} from "./log";

export type DailyActionKind =
  | "check_in"
  | "routine"
  | "photo"
  | "shelf"
  | "done";

export interface DailyAction {
  kind: DailyActionKind;
  title: string;
  body: string;
  /** CTA label — the card renders the screen's single PrimaryButton with it. */
  cta?: string;
  href?: string;
}

/** AM in the morning, PM in the evening; afternoons move on once AM is done. */
export function activePeriod(hour: number, amComplete: boolean): RoutinePeriod {
  if (hour < 12) return "am";
  if (hour >= 17) return "pm";
  return amComplete ? "pm" : "am";
}

export function dailyAction(ctx: {
  now: Date;
  checkInDue: boolean;
  firstCheckIn: boolean;
  day: DayLog | undefined;
  routine: Routine;
  streak: number;
  /** Days since the last progress photo (scan or check-in); null = never. */
  lastPhotoDaysAgo: number | null;
  shelfEmpty: boolean;
  /** Precomputed via scanEntryHref() so consent routing stays in one place. */
  scanHref: string;
}): DailyAction {
  const period = activePeriod(ctx.now.getHours(), periodComplete(ctx.day?.am));
  const steps = ctx.routine[period];
  const done = ctx.day?.[period]?.done ?? [];
  const complete =
    steps.length > 0 &&
    routineStepInstances(steps).every(({ key }) => done.includes(key));

  if (steps.length > 0 && !complete) {
    // Streak already counts today once any period is complete, so "finish Day
    // N" is only honest while today is still open.
    const todayCounted =
      periodComplete(ctx.day?.am) || periodComplete(ctx.day?.pm);
    const started = done.length > 0;
    return {
      kind: "routine",
      title: period === "am" ? "This morning's routine" : "Tonight's routine",
      body: todayCounted
        ? "Tonight keeps your week on track."
        : `Complete ${period === "am" ? "this morning's" : "tonight's"} routine to finish Day ${ctx.streak + 1}.`,
      cta: started
        ? "Continue routine"
        : `Start ${period === "am" ? "morning" : "evening"} routine`,
      href: `/(tabs)/routine?period=${period}`,
    };
  }

  if (ctx.lastPhotoDaysAgo === null) {
    return {
      kind: "photo",
      title: "Save your Day 1 photo",
      body: "Your first photo becomes a baseline you can review beside later photos.",
      cta: "Take my Day 1 photo",
      href: ctx.scanHref,
    };
  }
  if (ctx.lastPhotoDaysAgo >= 7) {
    return {
      kind: "photo",
      title: "Time for a progress photo",
      body: "A weekly photo may make appearance differences easier to review over time.",
      cta: "Take this week's photo",
      href: ctx.scanHref,
    };
  }

  if (ctx.checkInDue) {
    return ctx.firstCheckIn
      ? {
          kind: "check_in",
          title: "How does your skin feel today?",
          body: "An optional one-minute check-in adds how your skin feels alongside Day 1.",
          cta: "Share how it feels",
          href: "/check-in",
        }
      : {
          kind: "check_in",
          title: "Time for your weekly check-in",
          body: "Share what changed since your last check-in.",
          cta: "Start check-in",
          href: "/check-in",
        };
  }

  if (ctx.shelfEmpty) {
    return {
      kind: "shelf",
      title: "Complete your shelf",
      body: "Add your moisturizer to complete your shelf.",
      cta: "Add a product",
      href: "/(tabs)/routine?section=products",
    };
  }

  return {
    kind: "done",
    title: "Done. You protected today's progress.",
    body:
      period === "am"
        ? "Tonight keeps your week on track."
        : "Nothing left for today. See you tomorrow.",
  };
}
