/**
 * Pore Path onboarding value model.
 *
 * This module is intentionally pure: the preview screen renders this model but
 * does not decide what counts as scan evidence, which routine is safe, or what
 * an answer edit invalidates. Those decisions stay behind the existing tested
 * gates (`isCurrentScanAnalysis`, `isPlanCurrentForProfile`, and `routineFor`).
 */
import type { SkinGoal } from "@pore/shared";

import { answersOnlyReason, isCurrentScanAnalysis } from "./analysis-status";
import {
  GOAL_LABELS,
  frequencyLabel,
  stepLabel,
} from "./labels";
import { todayKey } from "./log";
import { routineFor } from "./plan";
import { isPlanCurrentForProfile } from "./profile-revision";
import { answerRows, type AnswerRow } from "./profile-rows";
import { GOAL_CHOICES } from "./questionnaire";
import { buildResults, type ConfidenceBand } from "./results";
import type { OnboardingData } from "@/state/onboarding";

export type PorePathSourceKind = "scan_and_answers" | "answers";

export interface PorePathSource {
  kind: PorePathSourceKind;
  label: "Scan + answers" | "Answers";
  detail: string;
  /** A prior photo read exists, but the current profile/attempt cannot use it. */
  staleScan: boolean;
  /** The preview should offer a secondary, optional scan action. */
  rescanRecommended: boolean;
}

export interface PorePathGoalHero {
  eyebrow: "YOUR PORE PATH";
  title: string;
  focus: string;
  supporting: string[];
  detail: string;
}

export interface PorePathPriority {
  rank: number;
  title: string;
  evidence: "scan" | "answers";
  detail: string;
  outlook: string;
  /** Scan-only fields. They are omitted, not blanked, for answer-derived cards. */
  appearanceLabel?: string;
  confidence?: ConfidenceBand;
  confidenceLabel?: string;
  regions?: string[];
  regionLabel?: string;
}

export type PorePathCheckpointId = "today" | "day_7" | "week_4";

export interface PorePathCheckpoint {
  id: PorePathCheckpointId;
  label: "Today" | "Day 7" | "Week 4";
  dateKey: string;
  dateLabel: string;
  accessibilityDate: string;
  title: string;
  detail: string;
  state: "current" | "upcoming";
}

export interface PorePathPeriodPlan {
  period: "am" | "pm";
  label: "Morning" | "Evening";
  stepCount: number;
  keySteps: string[];
}

export interface PorePathActiveGuidance {
  label: string;
  period: "AM" | "PM";
  frequency: string;
  ramp?: string;
}

export interface PorePathDailyPlan {
  am: PorePathPeriodPlan;
  pm: PorePathPeriodPlan;
  activeGuidance: PorePathActiveGuidance[];
  spf?: {
    label: "SPF";
    frequency: string;
    detail: string;
  };
  nextCheckIn: {
    label: "Next check-in";
    dateLabel: string;
    detail: string;
  };
}

export interface PorePathAction {
  id: "focus" | "pace" | "compare";
  title: string;
  detail: string;
}

export interface PorePathComparisonRow {
  id: "priorities" | "safety" | "progress";
  without: string;
  withPore: string;
}

export interface PorePathSafetyHighlight {
  id: string;
  tone: "info" | "caution" | "escalate";
  title: string;
  detail: string;
}

export interface OnboardingValueModel {
  source: PorePathSource;
  goalHero: PorePathGoalHero;
  priorities: PorePathPriority[];
  priorityNote?: string;
  checkpoints: PorePathCheckpoint[];
  dailyPlan: PorePathDailyPlan;
  actions: PorePathAction[];
  comparisonRows: PorePathComparisonRow[];
  safetyHighlights: PorePathSafetyHighlight[];
  answerRows: AnswerRow[];
  escalation: boolean;
  disclaimer: string;
}

const GOAL_HERO_TITLES: Record<SkinGoal, string> = {
  acne: "A focused path for breakout-prone skin",
  post_acne_marks: "A focused path for post-acne marks",
  hyperpigmentation: "A focused path for more even-looking tone",
  oiliness: "A focused path for balanced-looking skin",
  dryness: "A focused path for comfort and hydration",
  texture: "A focused path for smoother-looking texture",
  redness: "A focused path for calmer-looking skin",
  fine_lines: "A focused path for hydration and daily support",
  general_health: "A focused path for steady skin care",
};

const GOAL_ACTIONS: Record<SkinGoal, { title: string; detail: string }> = {
  acne: {
    title: "Keep the breakout plan consistent",
    detail:
      "Let your ranked breakout focus lead instead of changing several products at once.",
  },
  post_acne_marks: {
    title: "Protect the marks-focused routine",
    detail:
      "Keep the routine steady so weekly check-ins are easier to interpret.",
  },
  hyperpigmentation: {
    title: "Support an even-looking tone",
    detail:
      "Use the same ordered routine each day and compare under similar lighting.",
  },
  oiliness: {
    title: "Aim for balance, not over-cleansing",
    detail:
      "Follow the ordered routine instead of adding extra cleansing when skin looks shiny.",
  },
  dryness: {
    title: "Make comfort the first signal",
    detail:
      "Keep barrier-supporting steps consistent and notice how your skin feels after each routine.",
  },
  texture: {
    title: "Give texture-focused steps time",
    detail:
      "Follow the set frequency instead of adding extra exfoliation between scheduled days.",
  },
  redness: {
    title: "Keep the routine calm",
    detail:
      "Prioritize gentle, repeatable steps and avoid changing several products together.",
  },
  fine_lines: {
    title: "Build around daily support",
    detail:
      "Keep hydration and protection consistent before deciding whether the routine needs more.",
  },
  general_health: {
    title: "Start with a routine you can repeat",
    detail:
      "Use the first week to learn what feels practical before adding more complexity.",
  },
};

const GOAL_OUTLOOK: Record<SkinGoal, string> = {
  acne:
    "Use weekly check-ins to reflect on visible breakouts and routine comfort without judging day-to-day variation.",
  post_acne_marks:
    "Comparable weekly photos can make gradual appearance changes easier to reflect on.",
  hyperpigmentation:
    "Keep lighting consistent at check-ins so visible tone is easier to compare.",
  oiliness:
    "Track comfort and shine at the same time of day instead of reacting to one moment.",
  dryness:
    "Comfort can be a useful early check-in signal while visible dryness changes gradually.",
  texture:
    "Texture can vary with light, so use the same setup for each check-in.",
  redness:
    "Compare similar lighting and note comfort alongside visible redness.",
  fine_lines:
    "Hydration and lighting affect appearance, so standardized check-ins matter.",
  general_health:
    "Consistency and comfort are the first checkpoints for a new routine.",
};

interface RankedFocus {
  goal: SkinGoal;
  label: string;
}

function rankedFocuses(data: OnboardingData): RankedFocus[] {
  const selected = (data.goalChoiceIds ?? [])
    .map((id) => GOAL_CHOICES.find((choice) => choice.id === id))
    .filter((choice): choice is (typeof GOAL_CHOICES)[number] => choice !== undefined)
    .map((choice) => ({
      goal: choice.primary,
      label:
        choice.id === "unsure" ? GOAL_LABELS[choice.primary] : choice.label,
    }));
  if (selected.length > 0) return selected.slice(0, 3);

  const goals = data.goals ?? [];
  const ordered = data.primaryGoal
    ? [data.primaryGoal, ...goals.filter((goal) => goal !== data.primaryGoal)]
    : goals;
  const unique = ordered.filter(
    (goal, index, all) => all.indexOf(goal) === index,
  );
  if (unique.length > 0) {
    return unique.slice(0, 3).map((goal) => ({
      goal,
      label: GOAL_LABELS[goal],
    }));
  }
  return [{ goal: "general_health", label: GOAL_LABELS.general_health }];
}

function hasStaleScan(data: OnboardingData, currentScan: boolean): boolean {
  if (currentScan || !data.plan?.assessment) return false;
  return Boolean(
    !isPlanCurrentForProfile(data) ||
      data.scannedAt ||
      data.plan.scanId ||
      data.analysisStatus?.kind === "scan_analyzed",
  );
}

function sourceFor(data: OnboardingData): PorePathSource {
  const currentScan = isCurrentScanAnalysis(data);
  if (currentScan) {
    return {
      kind: "scan_and_answers",
      label: "Scan + answers",
      detail:
        "Your current validated photos and questionnaire answers shaped this path.",
      staleScan: false,
      rescanRecommended: false,
    };
  }

  const staleScan = hasStaleScan(data, currentScan);
  const reason = answersOnlyReason(data);
  const detail = staleScan
    ? "Your answers changed or the latest scan could not be used, so this path leaves older photo findings out. Re-scan whenever you want fresh photo insights."
    : reason === "quality_failed"
      ? "Those photos did not pass the quality gate, so this complete path uses your answers for now."
      : reason === "analysis_failed" || reason === "analysis_timeout"
        ? "Photo analysis did not finish this time, so this complete path uses your answers for now."
        : reason === "analysis_unconfigured"
          ? "Photo analysis is not connected in this build, so this complete path uses your answers."
          : "Your questionnaire answers shaped this path. A guided scan remains optional.";
  return {
    kind: "answers",
    label: "Answers",
    detail,
    staleScan,
    rescanRecommended: staleScan,
  };
}

function dateAfterLocalDays(now: Date, days: number): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
}

function checkpoint(
  now: Date,
  days: number,
  input: Omit<
    PorePathCheckpoint,
    "dateKey" | "dateLabel" | "accessibilityDate"
  >,
): PorePathCheckpoint {
  const date = dateAfterLocalDays(now, days);
  return {
    ...input,
    dateKey: todayKey(date),
    dateLabel: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    }),
    accessibilityDate: date.toLocaleDateString(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
  };
}

function checkpointsFor(
  now: Date,
  currentScan: boolean,
): PorePathCheckpoint[] {
  return [
    checkpoint(now, 0, {
      id: "today",
      label: "Today",
      title: "Start your safety-adjusted routine",
      detail: "Notice comfort and keep the first day simple.",
      state: "current",
    }),
    checkpoint(now, 7, {
      id: "day_7",
      label: "Day 7",
      title: currentScan ? "Your first comparison" : "Your first check-in",
      detail: currentScan
        ? "Take guided photos in similar light and reflect on comfort and consistency."
        : "Review comfort and consistency. Add a guided photo baseline whenever you want one.",
      state: "upcoming",
    }),
    checkpoint(now, 28, {
      id: "week_4",
      label: "Week 4",
      title: "Consistency review",
      detail:
        "Review your routine history and comparable check-ins before deciding what to adjust.",
      state: "upcoming",
    }),
  ];
}

function periodPlan(
  period: "am" | "pm",
  steps: ReturnType<typeof routineFor>["routine"]["am"],
  escalation: boolean,
): PorePathPeriodPlan {
  const visibleSteps = escalation
    ? steps.filter((step) => !step.active)
    : steps;
  return {
    period,
    label: period === "am" ? "Morning" : "Evening",
    stepCount: steps.length,
    keySteps: visibleSteps.slice(0, 4).map(stepLabel),
  };
}

function dailyPlanFor(
  data: OnboardingData,
  now: Date,
  checkpoints: PorePathCheckpoint[],
  escalation: boolean,
): PorePathDailyPlan {
  // `routineFor` is the final safety- and preference-adjusted routine. Passing
  // the local date keeps any date-aware revision semantics aligned with Today.
  const { routine } = routineFor(data, undefined, todayKey(now));
  const activeGuidance: PorePathActiveGuidance[] = [];
  if (!escalation) {
    for (const [period, steps] of [
      ["AM", routine.am],
      ["PM", routine.pm],
    ] as const) {
      for (const step of steps) {
        if (!step.active) continue;
        if (
          activeGuidance.some(
            (item) => `${item.period}:${item.label}` === `${period}:${stepLabel(step)}`,
          )
        ) {
          continue;
        }
        activeGuidance.push({
          label: stepLabel(step),
          period,
          frequency: frequencyLabel(step),
          ...(step.rampSchedule ? { ramp: step.rampSchedule } : {}),
        });
      }
    }
  }

  const spf = routine.am.find((step) => step.category === "sunscreen");
  const daySeven = checkpoints.find((item) => item.id === "day_7")!;
  return {
    am: periodPlan("am", routine.am, escalation),
    pm: periodPlan("pm", routine.pm, escalation),
    activeGuidance: activeGuidance.slice(0, 3),
    ...(spf
      ? {
          spf: {
            label: "SPF" as const,
            frequency: frequencyLabel(spf),
            detail: "Included in the final morning routine.",
          },
        }
      : {}),
    nextCheckIn: {
      label: "Next check-in",
      dateLabel: daySeven.dateLabel,
      detail: daySeven.title,
    },
  };
}

function safetyHighlightsFor(
  data: OnboardingData,
  escalation: boolean,
): PorePathSafetyHighlight[] {
  const highlights: PorePathSafetyHighlight[] = [];
  if (escalation) {
    highlights.push({
      id: "professional-review",
      tone: "escalate",
      title: "A professional check comes first",
      detail:
        "Pore's cosmetic read flagged something worth checking with a qualified professional before making treatment changes.",
    });
  }
  if (data.pregnancyOrBreastfeeding) {
    highlights.push({
      id: "pregnancy",
      tone: "caution",
      title: "Pregnancy-safe guard active",
      detail:
        "The final routine removes ingredients Pore should not recommend during pregnancy or breastfeeding.",
    });
  }
  if (data.usingPrescriptionSkincare || data.currentRoutine === "prescription") {
    highlights.push({
      id: "prescription",
      tone: "caution",
      title: "Prescription guard active",
      detail:
        "Pore keeps the plan gentle instead of stacking strong over-the-counter steps onto a prescription routine.",
    });
  }
  const restrictionCount =
    (data.allergies?.length ?? 0) + (data.allergyNotes?.trim() ? 1 : 0);
  if (restrictionCount > 0) {
    highlights.push({
      id: "reactions",
      tone: "caution",
      title: "Known reactions kept in view",
      detail: `${restrictionCount} ${restrictionCount === 1 ? "restriction is" : "restrictions are"} reflected in the safety check. Always confirm product labels for severe allergies.`,
    });
  }
  if (data.sensitivity === "high") {
    highlights.push({
      id: "sensitivity",
      tone: "info",
      title: "Slow-start mode active",
      detail:
        "The final routine limits stronger steps and keeps their frequency conservative.",
    });
  }
  if (highlights.length === 0) {
    highlights.push({
      id: "baseline",
      tone: "info",
      title: "Routine guardrails applied",
      detail:
        "Pore checked sensitivity, step order, frequency, and ingredient conflicts before showing this routine.",
    });
  }
  return highlights;
}

function actionsFor(
  focus: RankedFocus,
  dailyPlan: PorePathDailyPlan,
  data: OnboardingData,
  escalation: boolean,
): PorePathAction[] {
  if (escalation) {
    return [
      {
        id: "focus",
        title: "Check with a qualified professional",
        detail:
          "Share what you noticed and avoid using Pore's cosmetic guidance as a diagnosis.",
      },
      {
        id: "pace",
        title: "Keep changes gentle",
        detail:
          "Do not introduce a new strong treatment step while you are arranging that check.",
      },
      {
        id: "compare",
        title: "Record, do not self-diagnose",
        detail:
          "Comparable photos and short notes can help you describe change without labeling a condition.",
      },
    ];
  }

  const safetyMode =
    data.pregnancyOrBreastfeeding ||
    data.usingPrescriptionSkincare ||
    data.currentRoutine === "prescription" ||
    (data.allergies?.length ?? 0) > 0;
  const firstActive = dailyPlan.activeGuidance[0];
  const pace = safetyMode
    ? {
        id: "pace" as const,
        title: "Let your safety guards lead",
        detail:
          "Follow the final routine shown here; ingredients removed by your safety answers stay out.",
      }
    : firstActive
      ? {
          id: "pace" as const,
          title: "Use targeted steps on schedule",
          detail: `${firstActive.label} is set for ${firstActive.frequency.toLowerCase()}${firstActive.ramp ? `. ${firstActive.ramp}` : "."}`,
        }
      : {
          id: "pace" as const,
          title: "Protect the basics",
          detail:
            "Keep cleansing, moisturizing, and the final morning protection step repeatable.",
        };
  return [
    { id: "focus", ...GOAL_ACTIONS[focus.goal] },
    pace,
    {
      id: "compare",
      title: "Compare weekly, not daily",
      detail:
        "Use similar light and angles at check-ins so ordinary daily variation carries less weight.",
    },
  ];
}

function comparisonRowsFor(focus: string): PorePathComparisonRow[] {
  return [
    {
      id: "priorities",
      without: "Several competing tips and priorities",
      withPore: `One ranked focus: ${focus}`,
    },
    {
      id: "safety",
      without: "Guessing which stronger steps can stack",
      withPore: "A routine checked against sensitivity and safety answers",
    },
    {
      id: "progress",
      without: "Trying to remember what changed",
      withPore: "Guided, comparable check-ins at Day 7 and Week 4",
    },
  ];
}

/** Build the complete, presentation-ready onboarding value moment. */
export function buildOnboardingValueModel(
  data: OnboardingData,
  now: Date,
): OnboardingValueModel {
  const source = sourceFor(data);
  const currentScan = source.kind === "scan_and_answers";
  const results = buildResults(data);
  // Escalation is accepted only from the current validated scan gate in
  // buildResults. Stale assessments therefore cannot suppress or alter copy.
  const escalation = currentScan && results.escalate;
  const focuses = rankedFocuses(data);
  const lead = focuses[0];
  const checkpoints = checkpointsFor(now, currentScan);
  const dailyPlan = dailyPlanFor(data, now, checkpoints, escalation);

  const priorities: PorePathPriority[] = currentScan
    ? results.priorities.slice(0, 3).map((priority, index) => ({
        rank: index + 1,
        title: priority.title,
        evidence: "scan" as const,
        detail: priority.why,
        outlook: priority.outlook,
        ...(priority.appearanceLabel
          ? { appearanceLabel: priority.appearanceLabel }
          : {}),
        ...(priority.confidence ? { confidence: priority.confidence } : {}),
        ...(priority.confidenceLabel
          ? { confidenceLabel: priority.confidenceLabel }
          : {}),
        ...(priority.observedRegions.length > 0
          ? { regions: [...priority.observedRegions] }
          : {}),
        ...(priority.where ? { regionLabel: priority.where } : {}),
      }))
    : focuses.slice(0, 3).map((focus, index) => ({
        rank: index + 1,
        title: focus.label,
        evidence: "answers" as const,
        detail:
          index === 0
            ? "You chose this as the main focus for your plan."
            : `You ranked this as priority ${index + 1}.`,
        outlook: GOAL_OUTLOOK[focus.goal],
      }));

  return {
    source,
    goalHero: {
      eyebrow: "YOUR PORE PATH",
      title: GOAL_HERO_TITLES[lead.goal],
      focus: lead.label,
      supporting: focuses.slice(1).map((focus) => focus.label),
      detail: escalation
        ? "A professional check takes priority. Pore can still help you keep the routine gentle and the record consistent."
        : "Your first priority leads the plan. Supporting concerns stay in view without competing for attention.",
    },
    priorities,
    ...(currentScan && results.readNote
      ? { priorityNote: results.readNote }
      : {}),
    checkpoints,
    dailyPlan,
    actions: actionsFor(lead, dailyPlan, data, escalation),
    comparisonRows: comparisonRowsFor(lead.label),
    safetyHighlights: safetyHighlightsFor(data, escalation),
    answerRows: answerRows(data),
    escalation,
    disclaimer: currentScan
      ? results.disclaimer
      : "This path uses your questionnaire answers for cosmetic wellness guidance, not a medical diagnosis.",
  };
}
