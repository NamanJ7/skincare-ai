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
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import {
  adaptRoutine,
  compareAssessments,
  type CaptureAngle,
  type ConcernKey,
  type ConcernProgress,
  type ProgressReport,
} from "@pore/shared";
import { buildIntake } from "@/lib/intake";
import {
  adherenceRate,
  baselineAssessment,
  latestAssessment,
  readJournal,
  saveAdaptation,
  weeksOnRoutine,
  type Journal,
} from "@/lib/journal";
import { CAPTURE_STEPS, listSessions, sessionPhotoUri } from "@/lib/photos";
import { buildPlan } from "@/lib/plan";
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
  const [sessions, setSessions] = useState(() => listSessions());
  const [journal, setJournal] = useState<Journal>(() => readJournal());
  const [angle, setAngle] = useState<CaptureAngle>("front");
  const [assessing, setAssessing] = useState(false);
  const [assessError, setAssessError] = useState<string | null>(null);

  /**
   * Re-assessment runs here rather than on the capture screen, so capture stays
   * a camera and never a network call. The request goes through the ordinary
   * plan endpoint with only the new photos: it has no idea a previous session
   * exists, which is precisely what keeps the second reading blind.
   */
  const runReassessment = useCallback(async () => {
    const photos = data.photos ?? [];
    if (photos.length === 0) {
      // Reachable: the base64 payloads live in memory for one request only, so
      // arriving here on a reload or a back-navigation leaves nothing to send.
      // This used to return silently and fall through to whatever the journal
      // already held — showing a stale verdict as if it were the new one.
      setAssessError(
        "We don't have this set of photos in hand any more. Take a new set and we'll read it.",
      );
      return;
    }
    setAssessing(true);
    setAssessError(null);
    try {
      /*
       * Through `buildPlan`, which carries each photo's measured `quality`.
       *
       * This call used to build its own payload and drop that field. The
       * pipeline attaches `photoQuality` to the assessment straight from the
       * request (`apps/web/lib/pipeline.ts`), and the progress engine's
       * comparability gate is the only consumer: an angle counts only if it was
       * flagged clean AND its illuminant came back `screen_flash`. With the
       * field missing, every re-assessment arrived carrying an empty
       * `photoQuality`, no angle was ever measurable, and the verdict this whole
       * screen exists for could not be produced at all — the engine correctly
       * refused every single time, for a reason that was never about the photos.
       */
      const outcome = await buildPlan(data, photos, sessions[0]?.id);
      if (!outcome.ok) {
        setAssessError(`${outcome.error.message} Your photos are saved either way.`);
        return;
      }
      const recorded = readJournal();

      // Measure, then adapt — once, here, at the moment the reading lands.
      // `adaptRoutine` proposes against a routine and runs its own safety
      // clamp; re-running it on its own output would step the same active up
      // again, so this must never move into render.
      const base = recorded.routine ?? data.plan?.routine;
      const first = baselineAssessment(recorded);
      const last = latestAssessment(recorded);
      if (first && last && base) {
        const measured = compareAssessments(first.assessment, last.assessment, {
          before: first.capturedAt,
          after: last.capturedAt,
        });
        const out = adaptRoutine(base, measured, {
          intake: buildIntake(data),
          weeksOnRoutine: weeksOnRoutine(recorded),
          adherence: adherenceRate(recorded),
        });
        setJournal(saveAdaptation(out.routine, out.adjustments));
      } else {
        setJournal(recorded);
      }
      // The index gained a session while this ran; without re-reading it the
      // screen would still believe there is only one set and refuse to render.
      setSessions(listSessions());
    } catch {
      setAssessError("Something went wrong measuring this set. Your photos are safe — try again.");
    } finally {
      setAssessing(false);
    }
  }, [data, sessions]);

  useEffect(() => {
    if (mode === "recheck") void runReassessment();
  }, [mode, runReassessment]);

  const baseline = baselineAssessment(journal);
  const latest = latestAssessment(journal);
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
          Take a second guided set in a few weeks — same screen flash, same spot — and we can put
          your skin side by side with where it started.
        </AppText>
        {/*
          A recheck can reach this screen, complete its reading, write it to the
          journal, and still find only one stored session — the index write is
          best-effort and the assessment is not. Saying "nothing to compare"
          with no mention of the reading that just happened told the user their
          capture had vanished.
        */}
        {assessError && (
          <Card>
            <AppText variant="caption" color={colors.escalate}>
              {assessError}
            </AppText>
          </Card>
        )}
      </Screen>
    );
  }

  /*
   * The photographs and the verdict must describe the same two moments.
   *
   * This used to show `sessions[0]` against `sessions[1]` — the two most recent
   * — while the verdict above them compared the baseline against the latest.
   * With two sets those are the same pair; with three they silently are not,
   * and the screen would caption a measured change against photographs that
   * were never the ones measured. The baseline anchor wins, because a moving
   * zero is the thing the progress engine is built to refuse.
   */
  const newerId = latest?.sessionId ?? sessions[0]!.id;
  const olderId = baseline?.sessionId ?? sessions[sessions.length - 1]!.id;
  const newer = sessions.find((x) => x.id === newerId) ?? sessions[0]!;
  const older = sessions.find((x) => x.id === olderId) ?? sessions[1]!;

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <GhostButton label="Back" onPress={() => router.back()} />
      <AppText variant="label" color={colors.primary}>
        PROGRESS
      </AppText>
      {/*
        The headline promises only what the engine can back.
        A measured report gets its own headline; an unmeasurable one gets "Then
        and now", which is a description of two photographs and not a claim
        about skin.
      */}
      <AppText variant="title">
        {report?.comparable ? report.headline : "Then and now"}
      </AppText>
      {/*
        * Two elapsed-time numbers used to sit on this screen looking like the
        * same fact and disagreeing: this one is the gap between the two photo
        * sets, while the adaptation copy below counts weeks on the routine. They
        * genuinely measure different things — someone can start a routine long
        * before their first photo, or re-shoot late — so forcing them to match
        * would make one of them wrong. Naming what this number spans is the fix.
        */}
      {report && (
        <AppText variant="body" color={colors.inkMuted}>
          {`${Math.max(1, Math.round(report.daysBetween / 7))} weeks between these two photo sets, read separately so neither reading ever saw the other.`}
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

      {/*
       * The record comes first, and it is not the verdict.
       *
       * These two things used to be one thing, and the whole screen was gated on
       * a measurement that frequently — correctly — cannot be made: two sets shot
       * under different light are not subtractable, and the engine says so. That
       * left a user who had done everything asked of them looking at a refusal
       * and nothing else, six weeks after they started.
       *
       * So the photographs are hoisted above the verdict and rendered whether or
       * not anything could be measured. They are a record: here is you then, here
       * is you now, make of it what you like. They assert nothing, so there is
       * nothing for the engine to have to back. The measured verdict still sits
       * behind exactly the same gate it always did, one line further down — this
       * relaxes no threshold and changes no comparability rule.
       *
       * The risk this takes is that someone reads the pair AS a verdict. The
       * heading and the caption are what stand between here and there, which is
       * why they say what they say.
       */}
      <View style={{ flexDirection: "row", gap: spacing.xs }}>
        {CAPTURE_STEPS.map((s) => (
          <Chip
            key={s.angle}
            label={s.angle[0]!.toUpperCase() + s.angle.slice(1)}
            role="radio"
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

      <AppText variant="caption" color={colors.inkMuted}>
        Your own photos, side by side. We don&apos;t retouch, align or enhance them, and this
        pairing isn&apos;t a measurement — it&apos;s the record.
      </AppText>

      {report && !report.comparable && (
        <Card>
          <AppText variant="heading">We can&apos;t put a number on this one</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {report.blockedReason}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Shoot your next set indoors after dark, with the screen flash doing the lighting, and
            we&apos;ll be able to measure it properly.
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
