/**
 * Long-form legal document screen.
 *
 * Renders a LegalDocument from @pore/shared, so the wording is byte-identical
 * to the marketing site. Built only from the existing theme primitives and
 * React Native core — the app has no SVG or icon library, so the chevrons are
 * drawn with View borders (same technique as BrandMark).
 *
 * Section jumping measures each section's y via onLayout and calls scrollTo on
 * the Screen's ScrollView. Sections are direct children of the scroll content
 * container, so layout.y is already in the right coordinate space.
 */
import { router } from "expo-router";
import { useCallback, useRef } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, View } from "react-native";
import type { LegalBlock, LegalDocument } from "@pore/shared";

import { AppText, Card, Screen, colors, radius, spacing } from "@/theme";

/** Minimum comfortable tap target. */
const TAP = 44;
/** Breathing room left above a section when jumping to it. */
const JUMP_OFFSET = 12;
/** Legal prose gets a roomier line height than the default body token. */
const READING_LINE_HEIGHT = 27;

function Chevron({ direction }: { direction: "left" | "right" | "up" }) {
  const rotate =
    direction === "left" ? "135deg" : direction === "up" ? "-135deg" : "-45deg";
  return (
    <View
      style={[styles.chevron, { transform: [{ rotate }] }]}
      accessible={false}
      importantForAccessibility="no"
    />
  );
}

function Block({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "paragraph":
      return (
        <AppText
          variant="body"
          color={colors.inkMuted}
          style={{ lineHeight: READING_LINE_HEIGHT }}
        >
          {block.text}
        </AppText>
      );

    case "note":
      return (
        <Card style={styles.noteCard}>
          <AppText variant="bodyStrong" color={colors.accentInk}>
            {block.title}
          </AppText>
          <AppText
            variant="body"
            color={colors.inkMuted}
            style={{ lineHeight: READING_LINE_HEIGHT }}
          >
            {block.text}
          </AppText>
        </Card>
      );

    case "disclaimer":
      return (
        <Card>
          <AppText
            variant="body"
            color={colors.inkMuted}
            style={{ lineHeight: READING_LINE_HEIGHT }}
          >
            {block.text}
          </AppText>
        </Card>
      );

    case "contact":
      return (
        <Card>
          <AppText
            variant="body"
            color={colors.inkMuted}
            style={{ lineHeight: READING_LINE_HEIGHT }}
          >
            {block.text}
          </AppText>
          <Pressable
            onPress={() => Linking.openURL(`mailto:${block.email}`)}
            accessibilityRole="link"
            accessibilityLabel={`Email ${block.email}`}
            style={({ pressed }) => [
              styles.mailBtn,
              { backgroundColor: pressed ? colors.primaryPress : colors.primary },
            ]}
          >
            <AppText variant="bodyStrong" color={colors.onPrimary}>
              Email us
            </AppText>
          </Pressable>
          <AppText variant="caption" color={colors.inkMuted}>
            {block.email}
          </AppText>
        </Card>
      );
  }
}

export function LegalScreen({ doc }: { doc: LegalDocument }) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsets = useRef<Record<string, number>>({});

  const jumpTo = useCallback((id: string) => {
    const y = offsets.current[id];
    if (y === undefined) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - JUMP_OFFSET), animated: true });
  }, []);

  const toTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  return (
    <Screen scrollRef={scrollRef} contentStyle={{ gap: spacing.lg }}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={8}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
        >
          <Chevron direction="left" />
          <AppText variant="bodyStrong" color={colors.inkMuted}>
            Back
          </AppText>
        </Pressable>

        <AppText variant="label" color={colors.primary} style={styles.eyebrow}>
          LEGAL
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {doc.title}
        </AppText>

        <View style={styles.metaRow}>
          <View style={styles.badge}>
            <AppText variant="caption" color={colors.inkMuted}>
              {doc.status}
            </AppText>
          </View>
          <AppText variant="caption" color={colors.inkMuted}>
            Last updated {doc.lastUpdated}
          </AppText>
        </View>

        <AppText
          variant="body"
          color={colors.inkMuted}
          style={{ lineHeight: READING_LINE_HEIGHT }}
        >
          {doc.lede}
        </AppText>
      </View>

      {/* Section index */}
      <View>
        <AppText variant="label" color={colors.inkMuted} style={styles.eyebrow}>
          IN THIS DOCUMENT
        </AppText>
        <Card style={styles.tocCard}>
          {doc.sections.map((section, i) => (
            <Pressable
              key={section.id}
              onPress={() => jumpTo(section.id)}
              accessibilityRole="button"
              accessibilityLabel={`Jump to section ${i + 1}, ${section.title}`}
              style={({ pressed }) => [styles.tocRow, pressed && styles.pressed]}
            >
              <AppText variant="label" color={colors.primary} style={styles.tocNum}>
                {i + 1}
              </AppText>
              <AppText variant="body" style={styles.tocLabel}>
                {section.title}
              </AppText>
              <Chevron direction="right" />
            </Pressable>
          ))}
        </Card>
      </View>

      {/* Sections */}
      {doc.sections.map((section, i) => (
        <View
          key={section.id}
          onLayout={(e) => {
            offsets.current[section.id] = e.nativeEvent.layout.y;
          }}
          style={styles.section}
        >
          <View style={styles.sectionHeading}>
            <AppText variant="label" color={colors.primary}>
              {i + 1}
            </AppText>
            <AppText variant="heading" accessibilityRole="header" style={styles.sectionTitle}>
              {section.title}
            </AppText>
          </View>
          {section.blocks.map((block, j) => (
            <Block key={j} block={block} />
          ))}
        </View>
      ))}

      <Pressable
        onPress={toTop}
        accessibilityRole="button"
        accessibilityLabel="Back to top"
        style={({ pressed }) => [styles.backToTop, pressed && styles.pressed]}
      >
        <Chevron direction="up" />
        <AppText variant="bodyStrong" color={colors.inkMuted}>
          Back to top
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sm, paddingTop: spacing.xs },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: TAP,
    marginLeft: -spacing.xxs,
  },
  pressed: { opacity: 0.6 },
  eyebrow: { letterSpacing: 1.6 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flexWrap: "wrap" },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.hairline,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  tocCard: { padding: spacing.xs, gap: 0, marginTop: spacing.xs },
  tocRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: TAP,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  tocNum: { minWidth: 14 },
  tocLabel: { flex: 1 },
  section: { gap: spacing.sm, paddingTop: spacing.xs },
  sectionHeading: { flexDirection: "row", alignItems: "baseline", gap: spacing.xs },
  sectionTitle: { flex: 1 },
  noteCard: { backgroundColor: colors.accent, borderColor: colors.accent },
  mailBtn: {
    borderRadius: radius.pill,
    minHeight: TAP,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
    marginTop: spacing.xs,
  },
  backToTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    minHeight: TAP,
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
    paddingTop: spacing.md,
  },
  chevron: {
    width: 8,
    height: 8,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.inkMuted,
  },
});
