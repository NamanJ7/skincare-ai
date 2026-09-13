/**
 * Horizontal strip of progress photos, oldest → newest, labeled relative to
 * the Day 1 baseline. Thumbnails resolve stored relative names at render time
 * (photoUri) so records survive iOS container-path changes. Tapping a
 * thumbnail selects it for the compare view.
 */
import { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { photoStorageLine } from "@/lib/analysis-status";
import { photoUri } from "@/lib/photos";
import { timelineLabel, type TimelineEntry } from "@/lib/photo-timeline";
import {
  AppText,
  PhotoThumb,
  borderWidth,
  radius,
  spacing,
  useThemeColors,
} from "@/theme";

function dateLabel(entry: TimelineEntry): string {
  return new Date(entry.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PhotoTimeline({
  entries,
  selectedIndex,
  onSelect,
}: {
  entries: TimelineEntry[];
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const baseline = entries[0];
  if (!baseline) return null;
  return (
    <View style={{ gap: spacing.xs }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {entries.map((entry, i) => (
          <Pressable
            key={`${entry.createdAt}-${entry.photoName}`}
            onPress={() => onSelect?.(i)}
            accessibilityRole="imagebutton"
            accessibilityState={{ selected: i === selectedIndex }}
            accessibilityLabel={`${timelineLabel(baseline, entry)}, ${dateLabel(entry)}`}
            style={[
              styles.thumbWrap,
              i === selectedIndex && styles.thumbSelected,
            ]}
          >
            <PhotoThumb
              uri={photoUri(entry.photoName)}
              width={96}
              label={timelineLabel(baseline, entry)}
              sublabel={dateLabel(entry)}
            />
          </Pressable>
        ))}
      </ScrollView>
      <AppText variant="caption" color={colors.textSecondary}>
        {photoStorageLine()}
      </AppText>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    strip: { gap: spacing.sm },
    thumbWrap: {
      padding: spacing.xxs,
      borderRadius: radius.lg,
      borderWidth: borderWidth.emphasis,
      borderColor: "transparent",
    },
    thumbSelected: { borderColor: colors.actionPrimary },
  });
}
