/**
 * Then-and-now: the two most recent check-ins, one angle at a time. No session
 * picker — /history is where the rest live, and picking which two is a decision
 * nobody asked for.
 *
 * The photos are the honest part and always render. The findings comparison
 * above them is deterministic (`compareAssessments`) and frequently declines to
 * answer: too soon, lit differently, or read with too little confidence. When it
 * declines, this screen shows why rather than falling back to a softer claim.
 */
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { View } from "react-native";

import {
  CONCERN_LABELS,
  compareAssessments,
  type CaptureAngle,
  type ChangeDirection,
  type ProgressReport,
} from "@pore/shared";
import { CAPTURE_STEPS, listSessions, sessionPhotoUri } from "@/lib/photos";
import { listCheckIns, loadCheckIn } from "@/lib/plan";
import { AppText, Card, Chip, Divider, GhostButton, Screen, colors, radius, spacing } from "@/theme";

const DIRECTION_LABEL: Record<ChangeDirection, string> = {
  less_visible: "Less visible",
  steady: "About the same",
  more_visible: "More visible",
  unclear: "Can't say",
};

function directionColor(d: ChangeDirection): string {
  if (d === "less_visible") return colors.primary;
  if (d === "unclear") return colors.inkMuted;
  return colors.ink;
}

/** Compare the two most recent check-ins, when there are two to compare. */
function buildReport(): ProgressReport | null {
  const checkIns = listCheckIns();
  if (checkIns.length < 2) return null;
  const newer = loadCheckIn(checkIns[0]!.sessionId);
  const older = loadCheckIn(checkIns[1]!.sessionId);
  if (!newer || !older) return null;
  return compareAssessments(
    older.plan.assessment,
    older.savedAt,
    newer.plan.assessment,
    newer.savedAt,
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Compare() {
  const [sessions] = useState(() => listSessions());
  const [angle, setAngle] = useState<CaptureAngle>("front");
  const report = useMemo(buildReport, []);

  if (sessions.length < 2) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <GhostButton label="Back" onPress={() => router.back()} />
        <AppText variant="title">Not enough photos yet</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Take another guided photo at your next check-in and your progress will show up here.
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
      <AppText variant="title">Then and now</AppText>

      {report && (
        <Card elevated>
          <AppText variant="heading">What changed</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {report.summary}
          </AppText>
          {report.comparable && report.changes.length > 0 && (
            <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
              {report.changes.map((c, i) => (
                <View key={c.concern} style={{ gap: spacing.xxs }}>
                  {i > 0 && <Divider />}
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: spacing.sm,
                    }}
                  >
                    <AppText variant="body" style={{ flexShrink: 1 }}>
                      {CONCERN_LABELS[c.concern]}
                    </AppText>
                    <AppText variant="caption" color={directionColor(c.direction)}>
                      {DIRECTION_LABEL[c.direction]}
                    </AppText>
                  </View>
                  <AppText variant="caption" color={colors.inkMuted}>
                    {c.caveat ?? `${c.from} → ${c.to}`}
                  </AppText>
                </View>
              ))}
            </View>
          )}
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
        <PhotoColumn eyebrow="BEFORE" date={formatDate(older.capturedAt)} angle={angle} uri={sessionPhotoUri(older.id, angle)} />
        <PhotoColumn eyebrow="AFTER" date={formatDate(newer.capturedAt)} angle={angle} uri={sessionPhotoUri(newer.id, angle)} />
      </View>

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          Cosmetic appearance only — this is a side-by-side look, not a measurement of anything
          medical.
        </AppText>
      </Card>
    </Screen>
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
  uri?: string;
}) {
  return (
    <View style={{ flex: 1, gap: spacing.xxs }}>
      <AppText variant="label" color={colors.primary} style={{ textAlign: "center" }}>
        {eyebrow}
      </AppText>
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel={`${angle} photo from ${date}`}
          style={{
            width: "100%",
            aspectRatio: 3 / 4,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: "100%",
            aspectRatio: 3 / 4,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
            No photo saved
          </AppText>
        </View>
      )}
      <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
        {date}
      </AppText>
    </View>
  );
}
