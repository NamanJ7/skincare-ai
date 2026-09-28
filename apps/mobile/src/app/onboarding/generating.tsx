import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import type { AnalysisStatus } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { fetchPlan, type PlanResult } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { GOAL_LABELS } from "@/lib/labels";
import { todayKey } from "@/lib/log";
import { safeInternalHref } from "@/lib/route-access";
import { takePendingScanAttempt } from "@/lib/scan-session";
import { useOnboarding, type OnboardingData } from "@/state/onboarding";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  ProgressBar,
  Screen,
  StepCircle,
  spacing,
  useThemeColors,
} from "@/theme";

const ANSWERS_STEP = "Answers received";

const SCAN_STEP = "Reading your scan photos";

/**
 * The build checklist, echoing the user's own inputs where we have them so the
 * plan is visibly assembled from what THEY provided. The first step is already
 * true on arrival — their answers are in hand — so the list never starts empty.
 */
function stepsFor(data: OnboardingData, analyzing: boolean): string[] {
  const goal = data.primaryGoal
    ? `Centering on ${GOAL_LABELS[data.primaryGoal].toLowerCase()}`
    : "Understanding your skin goals";
  const sensitivity =
    data.sensitivity === "high"
      ? "Adjusting for your reactive skin"
      : "Adjusting for your sensitivity";
  const complexity =
    data.routineComplexity === "minimal"
      ? "Keeping your routine to the essentials"
      : data.routineComplexity === "flexible"
        ? "Adding detail only where it helps"
        : "Building a balanced routine";
  return [
    ANSWERS_STEP,
    ...(analyzing ? [SCAN_STEP] : []),
    goal,
    complexity,
    ...((data.currentProducts?.length ?? 0) > 0
      ? ["Checking the actives you already use"]
      : []),
    sensitivity,
    "Preparing your AM and PM routine",
  ];
}

const STEP_MS = 800;

export default function Generating() {
  const colors = useThemeColors();
  const params = useLocalSearchParams<{ next?: string }>();
  // Re-scans pass next=/(tabs); the funnel falls through to the preview.
  // Allowlisted rather than taken as given — this screen had no validation at
  // all, and it navigates without any further confirmation.
  const nextHref = safeInternalHref(params.next, "/onboarding/preview");

  const { data, update } = useOnboarding();
  const scanHistory = useScanHistory();
  // Claim this attempt (validated submission or an honest build failure) once.
  const [attempt] = useState(takePendingScanAttempt);
  const submission = attempt?.submission ?? null;
  const photoNames = attempt?.photoNames ?? [];
  // ANSWERS_STEP is complete the moment this screen mounts.
  const [done, setDone] = useState(1);
  const [settled, setSettled] = useState(false);

  const analyzing = submission != null;
  // Snapshot once — mid-flight profile updates (plan, analysisStatus) must not
  // reshuffle a checklist that is already animating.
  const [steps] = useState(() => stepsFor(data, analyzing));

  // Resolve exactly one AnalysisStatus for this attempt and persist it alongside
  // the plan. fetchPlan has its own timeout and never throws, so `settled` always
  // flips. On any non-ok outcome we set an answer-based status and leave any
  // prior plan untouched — the isCurrentScanAnalysis gate (not deletion) keeps a
  // stale plan from rendering as the current result.
  useEffect(() => {
    let active = true;
    (async () => {
      const attemptedAt = new Date().toISOString();
      let plan: PlanResult | null = null;
      let status: AnalysisStatus;

      if (submission) {
        const outcome = await fetchPlan({
          images: submission.images,
          intake: buildIntake(data),
          scanSession: submission.session,
        });
        if (outcome.status === "ok") {
          const scanId = submission.session.sessionId;
          plan = { ...outcome.plan, scanId };
          status = { kind: "scan_analyzed", scanId, analyzedAt: attemptedAt };
          track("analysis_completed", { mode: attempt ? "scan" : "answers" });
        } else if (outcome.status === "unconfigured") {
          status = {
            kind: "answers_only",
            reason: "analysis_unconfigured",
            attemptedAt,
          };
          track("analysis_failed", { reason: "analysis_unconfigured" });
        } else {
          status = {
            kind: "answers_only",
            reason:
              outcome.code === "timeout"
                ? "analysis_timeout"
                : "analysis_failed",
            attemptedAt,
            ...(outcome.message ? { message: outcome.message } : {}),
          };
          track("analysis_failed", {
            reason:
              outcome.code === "timeout"
                ? "analysis_timeout"
                : "analysis_failed",
          });
        }
      } else if (attempt?.buildFailure) {
        // A submission couldn't be assembled: an Expo Go/web build lacks the
        // on-device validator (treat as "not connected"); anything else is a
        // quality failure.
        const reason =
          attempt.buildFailure.code === "unsupported" ||
          attempt.buildFailure.code === "web_timeline_only"
            ? "analysis_unconfigured"
            : "quality_failed";
        status = {
          kind: "answers_only",
          reason,
          attemptedAt,
          message: attempt.buildFailure.message,
        };
        track("scan_failed", { reason });
        track("analysis_failed", { reason });
      } else {
        status = { kind: "answers_only", reason: "scan_skipped", attemptedAt };
      }

      if (!active) return;
      // Only advance scannedAt when analysis actually succeeded.
      update({
        analysisStatus: status,
        ...(plan
          ? {
              plan,
              scannedAt: attemptedAt,
              planProfileRevision: data.profileRevision ?? 0,
            }
          : {}),
      });

      // Record the scan for the Progress timeline whenever photos were saved —
      // even if analysis didn't run — but mark whether it was actually analyzed
      // so a photo-only record never implies a skin analysis.
      if (photoNames.length > 0 || plan) {
        scanHistory.add({
          date: todayKey(),
          createdAt: attemptedAt,
          photoNames,
          scanId: plan?.scanId,
          comparisonMetadata: attempt?.comparisonMetadata,
          analyzed: !!plan,
          summary: plan?.assessment.summary,
          assessment: plan?.assessment,
          findings: plan?.assessment.findings
            .filter((f) => f.present)
            .map((f) => ({
              concern: f.concern,
              appearanceLevel: f.appearanceLevel,
            })),
        });
      }
      setSettled(true);
    })();
    return () => {
      active = false;
    };
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reveal the checklist one step at a time.
  useEffect(() => {
    const timer = setInterval(() => {
      setDone((d) => {
        if (d >= steps.length) {
          clearInterval(timer);
          return d;
        }
        return d + 1;
      });
    }, STEP_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move on when BOTH the plan call settled and the checklist finished — the
  // animation is the minimum dwell, the fetch is the real work.
  useEffect(() => {
    if (done >= steps.length && settled) {
      const t = setTimeout(() => router.replace(nextHref), 500);
      return () => clearTimeout(t);
    }
  }, [done, settled, steps.length, nextHref]);

  // Belt-and-braces cap so this screen can never hold the user hostage.
  useEffect(() => {
    const cap = setTimeout(
      () => router.replace(nextHref),
      analyzing ? 75_000 : 15_000,
    );
    return () => clearTimeout(cap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen
      scroll={false}
      contentStyle={{ justifyContent: "center", gap: spacing.lg }}
    >
      <MascotCompanion
        state="observing"
        size="lg"
        accessibilityLabel={
          analyzing
            ? "Pore companion is reviewing your scan and answers"
            : "Pore companion is reviewing your answers"
        }
        style={{ alignSelf: "center" }}
      />
      <View style={{ gap: spacing.xs }}>
        <AppText variant="title" style={{ textAlign: "center" }}>
          Preparing your routine…
        </AppText>
        <AppText
          variant="body"
          color={colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          {analyzing
            ? "Pore is reading your scan and putting the pieces together."
            : "Pore is putting the pieces together."}
        </AppText>
      </View>

      <View style={{ gap: spacing.md, marginTop: spacing.md }}>
        {steps.map((label, i) => {
          const complete = i < done;
          const current = i === done;
          return (
            <View
              key={label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing.sm,
              }}
            >
              {current ? (
                <View
                  style={{
                    width: 24,
                    height: 24,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ActivityIndicator size="small" color={colors.actionPrimary} />
                </View>
              ) : (
                <StepCircle state={complete ? "done" : "upcoming"} />
              )}
              <AppText
                variant="bodyStrong"
                color={complete || current ? colors.textPrimary : colors.textSecondary}
              >
                {label}
              </AppText>
            </View>
          );
        })}
      </View>

      <ProgressBar value={Math.min(done, steps.length) / steps.length} />

      {done >= steps.length && !settled ? (
        <AppText
          variant="caption"
          color={colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          Almost there. We're finishing your analysis…
        </AppText>
      ) : null}
    </Screen>
  );
}
