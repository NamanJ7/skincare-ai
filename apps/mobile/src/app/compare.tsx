/**
 * The verdict — did any of this work?
 *
 * This is the only screen in Pore that is allowed to make a claim about
 * results, so it is built around what it refuses to say. The number comes from
 * `compareAssessments`, which subtracts two blind assessments rather than
 * asking a model whether things improved; when the two capture sessions are not
 * comparable it reports nothing and explains why. An honest "we can't tell"
 * outranks a flattering number, because a flattering number is exactly what
 * every other app in this category ships.
 *
 * Visually it is the one place the app uses a dark surface. The verdict card is
 * deep clinic green and everything else stays quiet cream, so the eye lands on
 * the answer first and the photographs read as supporting evidence rather than
 * the point.
 */
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  adaptRoutine,
  compareAssessments,
  type CaptureAngle,
  type ConcernKey,
  type ConcernProgress,
  type ProgressReport,
} from "@pore/shared";
import { PLAN_FAILURE_COPY, fetchPlan } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import {
  activeRoutine,
  adherenceRate,
  readJournal,
  recordAssessment,
  saveAdaptation,
  weeksOnRoutine,
  type Journal,
} from "@/lib/journal";
import { CAPTURE_STEPS, listSessions, sessionPhotoUri } from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, Chip, GhostButton, Screen, colors, radius, spacing } from "@/theme";

const CONCERN_LABELS: Record<ConcernKey, string> = {
  acne_like_breakouts: "Acne-like breakouts",
  oiliness: "Oiliness",
  dryness_flaking: "Dryness / flaking",
  texture_congestion: "Texture & congestion",
  uneven_tone: "Uneven tone",
  dark_spot_appearance: "Dark-spot appearance",
  redness_appearance: "Redness appearance",
  fine_line_appearance: "Fine-line appearance",
  irritation_signs: "Signs of irritation",
};

const BAND_LABELS: Record<string, string> = {
  none: "Clear",
  mild: "Mild",
  moderate: "Moderate",
  noticeable: "Noticeable",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Compare() {
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { data } = useOnboarding();
  const [sessions] = useState(() => listSessions());
  const [journal, setJournal] = useState<Journal>(() => readJournal());
  const [angle, setAngle] = useState<CaptureAngle>("front");
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);
  const inFlight = useRef<AbortController | null>(null);
  /** A re-assessment is two model calls. It runs once per visit, never on a re-render. */
  const ranOnce = useRef(false);

  /**
   * Re-assessment runs here rather than on the capture screen, so capture stays
   * a camera and never a network call. The request goes through the ordinary
   * plan endpoint with only the new photos: it has no idea a previous session
   * exists, which is precisely what keeps the second reading blind.
   */
  const runReassessment = useCallback(async () => {
    const photos = data.photos ?? [];
    if (photos.length === 0) {
      setAssessError(
        "We don't have the new photos in hand any more — take the set again and we'll measure it.",
      );
      return;
    }
    setAssessing(true);
    setAssessError(null);

    const controller = new AbortController();
    inFlight.current = controller;

    try {
      // The intake comes from the on-device record, not from onboarding state:
      // after a restart that state is empty, and re-reading with default
      // answers would clamp the adapted routine against the wrong person.
      const stored = readJournal();
      const outcome = await fetchPlan(
        {
          images: photos.map((p) => ({ data: p.data, mediaType: "image/jpeg", quality: p.quality })),
          intake: buildIntake(stored.intake ?? data),
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!outcome.ok) {
        setAssessError(PLAN_FAILURE_COPY[outcome.reason]);
        return;
      }
      const result = outcome.plan;
      const recorded = recordAssessment({
        sessionId: sessions[0]?.id ?? "current",
        capturedAt: photos[0]?.capturedAt ?? new Date().toISOString(),
        assessment: result.assessment,
      });

      // Measure, then adapt — once, here, at the moment the reading lands.
      // `adaptRoutine` proposes against a routine and runs its own safety
      // clamp; re-running it on its own output would step the same active up
      // again, so this must never move into render.
      const base = activeRoutine(recorded);
      if (recorded.baseline && recorded.latest && base) {
        const measured = compareAssessments(
          recorded.baseline.assessment,
          recorded.latest.assessment,
          { before: recorded.baseline.capturedAt, after: recorded.latest.capturedAt },
        );
        const out = adaptRoutine(base, measured, {
          intake: buildIntake(recorded.intake ?? data),
          weeksOnRoutine: weeksOnRoutine(recorded),
          adherence: adherenceRate(recorded),
        });
        setJournal(saveAdaptation(out.routine, out.adjustments));
      } else {
        setJournal(recorded);
      }
    } catch {
      setAssessError("Something went wrong measuring this set. Your photos are safe — try again.");
    } finally {
      if (!controller.signal.aborted) setAssessing(false);
    }
  }, [data, sessions]);

  useEffect(() => {
    if (mode !== "recheck" || ranOnce.current) return;
    ranOnce.current = true;
    void runReassessment();
  }, [mode, runReassessment]);

  // Leaving mid-measurement must not leave a request running against a screen
  // that no longer exists.
  useEffect(() => () => inFlight.current?.abort(), []);

  const { baseline, latest } = journal;
  const report: ProgressReport | null =
    baseline && latest
      ? compareAssessments(baseline.assessment, latest.assessment, {
          before: baseline.capturedAt,
          after: latest.capturedAt,
        })
      : null;

  // Read back what the adaptation decided, never recompute it.
  const adjustments = journal.lastAdaptation ?? [];

  if (assessing) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <GhostButton label="Back" tone="quiet" onPress={() => router.back()} />
        <AppText variant="label" color={colors.primary}>
          MEASURING
        </AppText>
        <AppText variant="title">Reading your new photos</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          We assess this set on its own, without showing it the old one. A read that knows what it is
          supposed to find will always find it.
        </AppText>
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      </Screen>
    );
  }

  if (sessions.length < 2) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <GhostButton label="Back" onPress={() => router.back()} />
        <AppText variant="title">Nothing to compare yet</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Take a second guided set in a few weeks — same screen flash, same spot — and we can measure
          what actually changed instead of guessing at it.
        </AppText>
      </Screen>
    );
  }

  const newer = sessions[0]!;
  const older = sessions[1]!;

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <GhostButton label="Back" onPress={() => router.back()} />
      <AppText variant="label" color={colors.primary}>
        PROGRESS
      </AppText>
      <AppText variant="title">{report ? report.headline : "Then and now"}</AppText>
      {report && (
        <AppText variant="body" color={colors.inkMuted}>
          {`Measured across ${Math.max(1, Math.round(report.daysBetween / 7))} weeks, from two separate readings that never saw each other.`}
        </AppText>
      )}

      {assessError && (
        <Card>
          <AppText variant="caption" color={colors.escalate}>
            {assessError}
          </AppText>
          <GhostButton label="Try measuring again" onPress={() => void runReassessment()} />
        </Card>
      )}

      {report && !report.comparable && (
        <Card>
          <AppText variant="heading">We can&apos;t call this one</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {report.blockedReason}
          </AppText>
        </Card>
      )}

      {report?.comparable && <VerdictCard report={report} />}

      {adjustments.length > 0 && (
        <Card>
          <AppText variant="heading">What changes in your routine</AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xxs }}>
            {adjustments.map((a, i) => (
              <AppText key={`${a.action}-${i}`} variant="caption" color={colors.ink}>
                • {a.detail}
              </AppText>
            ))}
          </View>
        </Card>
      )}

      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {CAPTURE_STEPS.map((s) => (
          <Chip
            key={s.angle}
            label={s.angle[0]!.toUpperCase() + s.angle.slice(1)}
            selected={angle === s.angle}
            onPress={() => setAngle(s.angle)}
          />
        ))}
      </View>

      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <PhotoColumn
          eyebrow="BEFORE"
          date={formatDate(older.capturedAt)}
          angle={angle}
          uri={sessionPhotoUri(older.id, angle)}
        />
        <PhotoColumn
          eyebrow="AFTER"
          date={formatDate(newer.capturedAt)}
          angle={angle}
          uri={sessionPhotoUri(newer.id, angle)}
        />
      </View>
    </Screen>
  );
}

/**
 * The one dark surface in the app. Measured concerns only — anything the engine
 * declined to call is listed separately below, never mixed in, so a refusal can
 * never be skimmed as a result.
 */
function VerdictCard({ report }: { report: ProgressReport }) {
  const measured = report.concerns.filter((c) => c.direction !== "not_comparable");
  const declined = report.concerns.filter((c) => c.direction === "not_comparable");

  return (
    <>
      <View
        style={{
          backgroundColor: colors.primary,
          borderRadius: radius.lg,
          padding: spacing.lg,
          gap: spacing.md,
        }}
      >
        {measured.length === 0 ? (
          <AppText variant="body" color={colors.onPrimary}>
            Nothing moved enough to call either way yet.
          </AppText>
        ) : (
          measured.map((c, i) => <VerdictRow key={c.concern} progress={c} first={i === 0} />)
        )}
      </View>

      {declined.length > 0 && (
        <Card>
          <AppText variant="heading">What we couldn&apos;t measure</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Left out on purpose. A number we don&apos;t trust is worse than a gap.
          </AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xxs }}>
            {declined.map((c) => (
              <AppText key={c.concern} variant="caption" color={colors.ink}>
                • {CONCERN_LABELS[c.concern]} — {c.reason}
              </AppText>
            ))}
          </View>
        </Card>
      )}
    </>
  );
}

function VerdictRow({ progress, first }: { progress: ConcernProgress; first: boolean }) {
  const improved = progress.direction === "improved";
  const worse = progress.direction === "worse";
  const movement = improved ? "Better" : worse ? "Worse" : "No change";

  return (
    <View
      style={{
        gap: spacing.xxs,
        borderTopWidth: first ? 0 : 1,
        borderTopColor: "rgba(255,255,255,0.14)",
        paddingTop: first ? 0 : spacing.md,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <AppText variant="bodyStrong" color={colors.onPrimary}>
          {CONCERN_LABELS[progress.concern]}
        </AppText>
        <AppText variant="caption" color={improved ? colors.accent : "rgba(255,255,255,0.75)"}>
          {movement}
        </AppText>
      </View>
      {progress.before && progress.after && (
        <AppText variant="caption" color="rgba(255,255,255,0.75)">
          {`${BAND_LABELS[progress.before] ?? progress.before} → ${BAND_LABELS[progress.after] ?? progress.after}`}
        </AppText>
      )}
    </View>
  );
}

function PhotoColumn({
  eyebrow,
  date,
  angle,
  uri,
}: {
  eyebrow: string;
  date: string;
  angle: CaptureAngle;
  uri: string | undefined;
}) {
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <AppText variant="label" color={colors.inkMuted}>
        {eyebrow}
      </AppText>
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: "100%", aspectRatio: 3 / 4, borderRadius: radius.md }}
          contentFit="cover"
          accessibilityLabel={`Your ${angle} photo from ${date}`}
        />
      ) : (
        <View
          style={{
            width: "100%",
            aspectRatio: 3 / 4,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText variant="caption" color={colors.inkMuted}>
            Not taken
          </AppText>
        </View>
      )}
      <AppText variant="caption" color={colors.inkMuted}>
        {date}
      </AppText>
    </View>
  );
}
