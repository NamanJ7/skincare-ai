/**
 * Skin-results logic — turns the vision Assessment (or, before a scan, the
 * user's stated goals) into a ranked, plain-language priority list the results
 * dashboard renders. Pure and network-free, mirroring plan.ts / insight.ts:
 * the screen is presentation only, the meaning lives here where it can be
 * unit-tested.
 *
 * Copy rules (PRD product principles): cosmetic and non-diagnostic, honest
 * about uncertainty, never overpromising. Confidence is surfaced, not hidden —
 * a low-confidence read is labelled, not dropped.
 */
import { activeSupportsConcern, lightColors } from "@pore/shared";
import type {
  ActiveKey,
  AppearanceLevel,
  Assessment,
  ConcernFinding,
  ConcernKey,
  ProductCategory,
  RegionObservation,
  Routine,
  RoutineStep,
  SkinGoal,
  ThemeColors,
} from "@pore/shared";

import {
  answersOnlyReason,
  isCurrentScanAnalysis,
  type AnswersOnlyReason,
} from "./analysis-status";
import { CONCERN_LABELS, GOAL_LABELS } from "./labels";
import { stepKey, type RoutinePeriod } from "./log";
import type { ScanHistory } from "./scan-history";
import type { OnboardingData } from "@/state/onboarding";

export type ConfidenceBand = "high" | "moderate" | "low";

/** Broad, non-diagnostic regions the existing analysis contract may return. */
export type ObservedRegion =
  | "forehead"
  | "cheeks"
  | "nose"
  | "chin"
  | "jaw"
  | "under-eye"
  | "around mouth"
  | "temples";

/** One thing to focus on, ready to render. */
export interface SkinPriority {
  concern: ConcernKey;
  /** User-facing heading, e.g. "Dark-spot appearance". */
  title: string;
  /** Appearance intensity word, e.g. "Moderate" (omitted for answer-only). */
  appearanceLabel?: string;
  /**
   * Label colour for the appearance band.
   *
   * Deliberately the only intensity-ish field here. There is no 0..1 severity
   * number: nothing in the pipeline measures a concern's magnitude, so any
   * such number would be decoration dressed as data.
   */
  tone: string;
  /** Present only for scan-derived priorities. */
  confidence?: ConfidenceBand;
  confidenceLabel?: string;
  /** Plain-language "why we flagged this". */
  why: string;
  /** Sanitized broad regions. Empty for answer-derived priorities. */
  observedRegions: ObservedRegion[];
  /** Where on the face it shows, e.g. "Mostly around your cheeks and chin". */
  where?: string;
  /** Calm, realistic outlook with routine consistency. */
  outlook: string;
}

export interface ResultsView {
  /** "scan" once photos have been read; "answers" before that. */
  source: "scan" | "answers";
  /** Supportive one-paragraph summary. */
  summary: string;
  priorities: SkinPriority[];
  /** Uncertainty / image-quality note, when something was hard to read. */
  readNote?: string;
  /** True when the assessment flagged something for a professional. */
  escalate: boolean;
  reasons: string[];
  disclaimer: string;
}

export const APPEARANCE_LABELS: Record<AppearanceLevel, string> = {
  none: "Clear",
  mild: "Mild",
  moderate: "Moderate",
  noticeable: "Noticeable",
};

/** Results-story wording; the exported legacy labels remain stable for Progress. */
const RESULTS_APPEARANCE_LABELS: Record<AppearanceLevel, string> = {
  none: "No visible appearance",
  mild: "Subtle appearance",
  moderate: "Visible appearance",
  noticeable: "More noticeable appearance",
};

export const APPEARANCE_RANK: Record<AppearanceLevel, number> = {
  none: 0,
  mild: 1,
  moderate: 2,
  noticeable: 3,
};

/** Warmer as the concern is more visible (green barely-there → amber prominent). */
function toneFor(level: AppearanceLevel, theme: ThemeColors): string {
  if (level === "noticeable") return theme.warning;
  if (level === "moderate") return theme.info;
  return theme.success;
}

const DEFAULT_DISCLAIMER =
  "This is a cosmetic look at what's visible in your photos, not a medical diagnosis. See a professional for anything painful, spreading, or changing quickly.";

const ANSWER_DISCLAIMER =
  "This plan uses your questionnaire answers for cosmetic wellness guidance, not a medical diagnosis. See a professional for anything painful, spreading, or changing quickly.";

/** Calm, realistic outlook per concern. Never a guarantee or a timeline promise. */
const OUTLOOK: Record<ConcernKey, string> = {
  acne_like_breakouts:
    "Visible change usually takes several weeks. Consistency matters more than any single product.",
  oiliness:
    "A steadier feel can take several weeks as your routine supports a more balanced surface.",
  dryness_flaking:
    "Comfort may improve within days, while visible flaking or texture can take a few weeks.",
  texture_congestion:
    "Visible texture changes are gradual and usually take several weeks to a few months.",
  uneven_tone:
    "Visible tone changes usually take several weeks to a few months, with daily sunscreen supporting the process.",
  dark_spot_appearance:
    "Marks often change gradually over weeks to months. Daily sunscreen helps protect them from deepening in the meantime.",
  redness_appearance:
    "Comfort may settle before visible redness; give a gentle routine several days to a few weeks.",
  fine_line_appearance:
    "Visible softening is gradual and is usually measured over a few months, with hydration and daily sunscreen supporting it.",
  irritation_signs:
    "Comfort may improve over several days once stronger steps are eased back; visible calm can take a few weeks.",
};

/** Maps a stated goal to its closest visible concern (for answer-only outlook). */
const GOAL_TO_CONCERN: Partial<Record<SkinGoal, ConcernKey>> = {
  acne: "acne_like_breakouts",
  post_acne_marks: "dark_spot_appearance",
  hyperpigmentation: "uneven_tone",
  oiliness: "oiliness",
  dryness: "dryness_flaking",
  texture: "texture_congestion",
  redness: "redness_appearance",
  fine_lines: "fine_line_appearance",
};

/** Inert categories that directly support each concern without implying an active. */
const BASE_SUPPORT_CATEGORIES: Record<ConcernKey, readonly ProductCategory[]> =
  {
    acne_like_breakouts: ["cleanser", "spot_treatment"],
    oiliness: ["cleanser", "moisturizer"],
    dryness_flaking: ["cleanser", "moisturizer"],
    texture_congestion: ["exfoliant"],
    uneven_tone: ["sunscreen"],
    dark_spot_appearance: ["sunscreen"],
    redness_appearance: ["cleanser", "moisturizer"],
    fine_line_appearance: ["moisturizer", "sunscreen"],
    irritation_signs: ["cleanser", "moisturizer"],
  };

export interface RoutineSupportStep {
  period: RoutinePeriod;
  step: RoutineStep;
  /** Period-qualified stable step identity used by Routine. */
  key: string;
}

/**
 * Finds support only in the routine supplied by the caller. Results passes the
 * final safety- and revision-adjusted routine so removed or paused steps can
 * never reappear here.
 */
export function routineSupportForConcern(
  concern: ConcernKey,
  routine: Routine,
): RoutineSupportStep[] {
  const baseCategories = new Set(BASE_SUPPORT_CATEGORIES[concern]);
  const collect = (
    period: RoutinePeriod,
    steps: readonly RoutineStep[],
  ): RoutineSupportStep[] =>
    steps
      .filter((step) =>
        step.active
          ? activeSupportsConcern(step.active as ActiveKey, concern)
          : baseCategories.has(step.category),
      )
      .map((step) => ({
        period,
        step,
        key: `${period}:${stepKey(step)}`,
      }));

  return [...collect("am", routine.am), ...collect("pm", routine.pm)];
}

/** Prefer the relevant current period, then the other one, with a stable fallback. */
export function routinePeriodForSupport(
  support: readonly RoutineSupportStep[],
  preferred: RoutinePeriod,
): RoutinePeriod {
  if (support.some((item) => item.period === preferred)) return preferred;
  const other: RoutinePeriod = preferred === "am" ? "pm" : "am";
  return support.some((item) => item.period === other) ? other : preferred;
}

export function confidenceBand(confidence: number): ConfidenceBand {
  if (confidence >= 0.7) return "high";
  if (confidence >= 0.45) return "moderate";
  return "low";
}

function confidenceLabel(band: ConfidenceBand): string {
  if (band === "high") return "Fairly clear read.";
  if (band === "moderate") return "Some visual support.";
  return "This read was harder to confirm.";
}

/** "Mostly around your forehead and cheeks." — omitted when regions unknown. */
const REGION_ALIASES: Readonly<Record<string, ObservedRegion>> = {
  forehead: "forehead",
  cheeks: "cheeks",
  nose: "nose",
  chin: "chin",
  jaw: "jaw",
  "under-eye": "under-eye",
  "under eye": "under-eye",
  "under-eye area": "under-eye",
  "under eye area": "under-eye",
  "around mouth": "around mouth",
  temples: "temples",
};

const REGION_COPY: Record<ObservedRegion, string> = {
  forehead: "forehead",
  cheeks: "cheeks",
  nose: "nose",
  chin: "chin",
  jaw: "jaw",
  "under-eye": "under-eye area",
  "around mouth": "mouth area",
  temples: "temples",
};

/** Narrows untrusted/legacy strings to broad regions without inventing detail. */
export function observedRegions(input: readonly string[]): ObservedRegion[] {
  const out: ObservedRegion[] = [];
  for (const raw of input) {
    const normalized = raw.trim().toLowerCase().replace(/\s+/g, " ");
    const region = REGION_ALIASES[normalized];
    if (region && !out.includes(region)) out.push(region);
  }
  return out;
}

/**
 * Same narrowing, but strongest area first.
 *
 * A concern is rarely even across the face, and "most visible around your
 * cheeks and forehead" is only true if the list is actually ordered by how
 * visible it was. Falls back to the flat order when a finding carries no
 * per-region reading, so a legacy stored plan renders exactly as before.
 */
export function regionsByAppearance(
  detail: readonly RegionObservation[],
  fallback: readonly string[],
): ObservedRegion[] {
  if (detail.length === 0) return observedRegions(fallback);
  const ranked = [...detail].sort(
    (a, b) => APPEARANCE_RANK[b.appearanceLevel] - APPEARANCE_RANK[a.appearanceLevel],
  );
  return observedRegions(ranked.map((entry) => entry.region));
}

/** Broad-region summary, omitted when the analysis returned nothing supported. */
export function regionSummary(regions: readonly string[]): string | undefined {
  const clean = observedRegions(regions).map((region) => REGION_COPY[region]);
  if (clean.length === 0) return undefined;
  if (clean.length === 1) return `Most visible around your ${clean[0]}.`;
  const head = clean.slice(0, -1).join(", ");
  const tail = clean[clean.length - 1];
  return `Most visible around your ${head} and ${tail}.`;
}

/**
 * Present, non-"none" findings ranked by how much the read actually supports.
 *
 * Sorting by appearance first and using confidence only as a tie-break let a
 * barely-supported "noticeable" outrank a near-certain "moderate" and take one
 * of the three visible slots. Weighting the two together means the priorities
 * we lead with are the ones we can stand behind, which is also what keeps them
 * consistent with the routine: the evidence policy only treats a concern once
 * it clears a confidence floor.
 */
export function rankFindings(findings: ConcernFinding[]): ConcernFinding[] {
  const support = (finding: ConcernFinding) =>
    APPEARANCE_RANK[finding.appearanceLevel] * finding.confidence;
  return findings
    .filter((f) => f.present && f.appearanceLevel !== "none")
    .sort((a, b) => {
      const weighted = support(b) - support(a);
      if (weighted !== 0) return weighted;
      const rank =
        APPEARANCE_RANK[b.appearanceLevel] - APPEARANCE_RANK[a.appearanceLevel];
      return rank !== 0 ? rank : b.confidence - a.confidence;
    });
}

function priorityFromFinding(
  f: ConcernFinding,
  theme: ThemeColors,
): SkinPriority {
  const band = confidenceBand(f.confidence);
  const factors = f.contributingFactors
    .map((factor) => factor.trim())
    .filter(Boolean);
  const regions = regionsByAppearance(f.regionDetail ?? [], f.regions);
  return {
    concern: f.concern,
    title: CONCERN_LABELS[f.concern],
    appearanceLabel: RESULTS_APPEARANCE_LABELS[f.appearanceLevel],
    tone: toneFor(f.appearanceLevel, theme),
    confidence: band,
    confidenceLabel: confidenceLabel(band),
    why:
      factors.length > 0
        ? `What informed this read: ${asSentence(factors.join("; "))}`
        : "Pore noticed this appearance in your scan photos.",
    observedRegions: regions,
    where: regionSummary(regions),
    outlook: OUTLOOK[f.concern],
  };
}

function scanResults(assessment: Assessment, theme: ThemeColors): ResultsView {
  const ranked = rankFindings(assessment.findings);
  const priorities = ranked
    .slice(0, 3)
    .map((finding) => priorityFromFinding(finding, theme));

  // Surface uncertainty honestly: flag when the top reads were low-confidence.
  const lowConfidence =
    priorities.length > 0 && priorities.every((p) => p.confidence === "low");
  const someLow = priorities.some((p) => p.confidence === "low");
  const readNote =
    priorities.length === 0
      ? "Pore didn't find a clear cosmetic priority in these photos. That can reflect your skin, the lighting, or what the camera could capture. Keep your routine steady."
      : lowConfidence
        ? "Your photos were a little hard to read. Retake in brighter, even light (face a window) for a more confident result."
        : someLow
          ? "A couple of these were harder to read from your photos. Take them as a direction, not a verdict."
          : undefined;

  return {
    source: "scan",
    summary: assessment.summary,
    priorities,
    readNote,
    escalate: assessment.escalation.recommendProfessional,
    reasons: assessment.escalation.reasons,
    disclaimer: assessment.disclaimer || DEFAULT_DISCLAIMER,
  };
}

/** Ordered goals with the primary concern first (mirrors buildIntake). */
function orderedGoals(data: OnboardingData): SkinGoal[] {
  const goals = data.goals ?? [];
  if (data.primaryGoal && goals.includes(data.primaryGoal)) {
    return [data.primaryGoal, ...goals.filter((g) => g !== data.primaryGoal)];
  }
  return goals;
}

/**
 * Summary + uncertainty note for an answer-based read, varied by *why* we
 * couldn't use a scan — calm and honest, never implying a scan happened.
 */
function answerReadCopy(
  reason: AnswersOnlyReason | undefined,
  focus: string,
): { summary: string; readNote: string } {
  switch (reason) {
    case "quality_failed":
      return {
        summary: `Those photos didn't pass our quality checks, so this plan is based on your answers for now. It focuses on ${focus}.`,
        readNote:
          "We couldn't analyze those photos because they didn't pass quality checks. Retake in brighter, even light (face a window) to turn this into a photo-based read.",
      };
    case "analysis_unconfigured":
      return {
        summary: `Scan analysis isn't connected in this build, so this plan is based on your answers. It focuses on ${focus}.`,
        readNote:
          "Scan analysis isn't connected in this build, so this plan is based on your questionnaire answers.",
      };
    case "analysis_failed":
      return {
        summary: `We couldn't complete scan analysis this time, so this plan is based on your answers. It focuses on ${focus}.`,
        readNote:
          "We couldn't complete scan analysis this time. Your routine is based on your answers for now. Try a scan again when you're ready.",
      };
    case "analysis_timeout":
      return {
        summary: `Scan analysis took a little too long this time, so this plan is based on your answers. It focuses on ${focus}.`,
        readNote:
          "Scan analysis took too long this time. Your routine is based on your answers for now. Try again when you're ready.",
      };
    default: // scan_skipped / none
      return {
        summary: `Based on your answers, Pore is focusing your plan on ${focus}. A guided face scan adds a visual read, so Pore can confirm what's actually showing on your skin and sharpen these priorities.`,
        readNote:
          "These come from what you told us. Run a guided scan to turn them into a photo-based read.",
      };
  }
}

function answerResults(
  data: OnboardingData,
  theme: ThemeColors,
  reason?: AnswersOnlyReason,
): ResultsView {
  const goals = orderedGoals(data);
  const priorities: SkinPriority[] = goals
    .filter((g) => g !== "general_health")
    .slice(0, 3)
    .map((goal) => {
      const concern = GOAL_TO_CONCERN[goal];
      return {
        concern: concern ?? "irritation_signs",
        title: GOAL_LABELS[goal],
        tone: theme.info,
        why: "You told us this is a focus area.",
        observedRegions: [],
        outlook: concern
          ? OUTLOOK[concern]
          : "A simpler, more consistent routine is what moves this over time.",
      };
    });

  // `goals` is stored profile data that normalizeProfile passes through
  // untouched, so an older build's goal key can survive into this map lookup.
  const goalWords = goals
    .filter((g) => g !== "general_health")
    .slice(0, 2)
    .map((g) => GOAL_LABELS[g]?.toLowerCase())
    .filter((label): label is string => !!label);
  const focus =
    goalWords.length > 0
      ? goalWords.join(" and ")
      : "a routine that actually fits your skin";

  const { summary, readNote } = answerReadCopy(reason, focus);

  return {
    source: "answers",
    summary,
    priorities,
    readNote,
    escalate: false,
    reasons: [],
    disclaimer: ANSWER_DISCLAIMER,
  };
}

/**
 * The dashboard's single entry point. Uses the vision assessment ONLY when the
 * current attempt actually produced a valid scan analysis (isCurrentScanAnalysis
 * — a stale plan from a prior/failed scan won't qualify); otherwise it returns a
 * clearly-labelled answer-based read, varied by why analysis didn't happen.
 */
export function buildResults(
  data: OnboardingData,
  theme: ThemeColors = lightColors,
): ResultsView {
  if (isCurrentScanAnalysis(data) && data.plan?.assessment) {
    return scanResults(data.plan.assessment, theme);
  }
  return answerResults(data, theme, answersOnlyReason(data));
}

/** Date of the exact scan whose evidence is currently rendered. */
export function currentScanDate(data: OnboardingData): Date | undefined {
  if (!isCurrentScanAnalysis(data)) return undefined;
  const candidates =
    data.analysisStatus?.kind === "scan_analyzed"
      ? [data.analysisStatus.analyzedAt, data.scannedAt]
      : [data.scannedAt];
  for (const value of candidates) {
    if (!value) continue;
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return undefined;
}

/** Avoid offering a retry loop in builds where scan analysis is unavailable. */
export function canOfferGuidedScan(data: OnboardingData): boolean {
  return answersOnlyReason(data) !== "analysis_unconfigured";
}

/** Render a specific historical assessment (e.g. a past scan's detail view). */
export function scanResultsFromAssessment(
  assessment: Assessment,
  theme: ThemeColors = lightColors,
): ResultsView {
  return scanResults(assessment, theme);
}

/**
 * Returns only the persisted front photo belonging to the assessment currently
 * rendered as scan evidence. It never falls back to a side, failed, or stale scan.
 */
export function currentScanFrontPhotoName(
  data: OnboardingData,
  history: ScanHistory,
): string | undefined {
  if (!isCurrentScanAnalysis(data)) return undefined;

  const frontName = (names: readonly string[]) =>
    names.find((name) => name.toLowerCase().endsWith("-front.jpg"));
  const status = data.analysisStatus;

  if (status?.kind === "scan_analyzed") {
    for (let index = history.scans.length - 1; index >= 0; index -= 1) {
      const scan = history.scans[index];
      if (
        scan.analyzed === true &&
        scan.assessment &&
        scan.scanId === status.scanId
      ) {
        const front = frontName(scan.photoNames);
        if (front) return front;
      }
    }
    return undefined;
  }

  // Legacy profiles predate scan ids/status. Their successful analysis and
  // history record shared the exact same timestamp, which is the only safe join.
  if (!status && data.scannedAt) {
    for (let index = history.scans.length - 1; index >= 0; index -= 1) {
      const scan = history.scans[index];
      if (scan.createdAt !== data.scannedAt) continue;
      return frontName(scan.photoNames);
    }
  }
  return undefined;
}

function sentenceCase(s: string): string {
  const trimmed = s.trim();
  if (!trimmed) return trimmed;
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function asSentence(s: string): string {
  const cased = sentenceCase(s);
  return /[.!?]$/.test(cased) ? cased : `${cased}.`;
}
