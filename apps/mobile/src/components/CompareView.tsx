/**
 * Side-by-side progress comparison: Day 1 baseline on the left, a selected
 * later photo on the right. Copy is deliberately cautious — appearance
 * language from what the user reported, never percentage claims.
 */
import { View } from "react-native";

import { photoUri } from "@/lib/photos";
import { timelineLabel, type TimelineEntry } from "@/lib/photo-timeline";
import { AppText, PhotoThumb, spacing, useThemeColors } from "@/theme";

function dateLabel(entry: TimelineEntry): string {
  return new Date(entry.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function CompareView({
  baseline,
  selected,
  copy,
}: {
  baseline: TimelineEntry;
  selected: TimelineEntry;
  /** The one cautious "what changed" line. */
  copy: string;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", gap: spacing.sm }}>
        <PhotoThumb
          uri={photoUri(baseline.photoName)}
          label="Day 1"
          sublabel={dateLabel(baseline)}
        />
        <PhotoThumb
          uri={photoUri(selected.photoName)}
          label={timelineLabel(baseline, selected)}
          sublabel={dateLabel(selected)}
        />
      </View>
      <AppText variant="caption" color={colors.textSecondary}>
        {copy}
      </AppText>
    </View>
  );
}
