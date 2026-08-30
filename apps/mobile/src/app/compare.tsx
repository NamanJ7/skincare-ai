/**
 * Then-and-now: the newest capture session against the one before it, one
 * angle at a time. No session picker — two sessions is the whole feature,
 * and picking which two is a decision nobody asked for.
 */
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import type { CaptureAngle } from "@pore/shared";
import { CAPTURE_STEPS, listSessions, sessionPhotoUri } from "@/lib/photos";
import { AppText, Card, Chip, GhostButton, Screen, colors, radius, spacing } from "@/theme";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Compare() {
  const [sessions] = useState(() => listSessions());
  const [angle, setAngle] = useState<CaptureAngle>("front");

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
