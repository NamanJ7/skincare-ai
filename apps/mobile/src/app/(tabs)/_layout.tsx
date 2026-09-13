/**
 * Post-onboarding tab shell. The center Scan tab renders as a raised
 * brand-green circle — the signature action — via a custom tabBarButton.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import { useMemo, type ComponentProps } from "react";
import { Pressable, StyleSheet, View, type ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ThemeColors } from "@pore/shared";

import { APP_TABS } from "@/lib/app-tabs";
import {
  AppText,
  borderWidth,
  iconSize,
  shadow,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";
import { resolveFontFamily } from "@/theme/fonts";

function icon(
  name: keyof typeof Ionicons.glyphMap,
  focusedName: keyof typeof Ionicons.glyphMap,
) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <Ionicons
      name={focused ? focusedName : name}
      size={iconSize.lg}
      color={color}
    />
  );
}

/** Raised circular Scan button; replaces the default icon+label entirely. */
type ScanTabButtonProps = Pick<
  ComponentProps<typeof Pressable>,
  | "onPress"
  | "onLongPress"
  | "accessibilityLabel"
  | "accessibilityState"
  | "testID"
>;

function ScanTabButton({
  onPress,
  onLongPress,
  accessibilityLabel,
  accessibilityState,
  testID,
}: ScanTabButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const focused = accessibilityState?.selected;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.scanWrap}
      accessibilityRole="tab"
      accessibilityLabel={accessibilityLabel ?? "Scan"}
      accessibilityState={accessibilityState}
      testID={testID}
      hitSlop={8}
    >
      <View style={[styles.scanCircle, focused && styles.scanCircleFocused]}>
        <Ionicons name="scan" size={iconSize.xl} color={colors.onActionPrimary} />
      </View>
      <AppText
        variant="label"
        color={focused ? colors.actionPrimary : colors.textSecondary}
        style={styles.scanLabel}
      >
        Scan
      </AppText>
    </Pressable>
  );
}

export default function TabsLayout() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.actionPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.navBackground,
          borderTopWidth: borderWidth.hairline,
          borderTopColor: colors.border,
          height: 62 + insets.bottom,
          paddingTop: spacing.xxs,
          paddingBottom: Math.max(insets.bottom, spacing.xxs),
        },
        tabBarItemStyle: { minWidth: 0 },
        tabBarLabelStyle: {
          fontFamily: resolveFontFamily("body", "600"),
          fontSize: 11,
        },
      }}
    >
      {APP_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={
            tab.name === "scan"
              ? {
                  title: tab.title,
                  tabBarButton: (props) => (
                    <ScanTabButton
                      onPress={props.onPress}
                      onLongPress={props.onLongPress}
                      accessibilityLabel={props.accessibilityLabel}
                      accessibilityState={props.accessibilityState}
                      testID={props.testID}
                    />
                  ),
                }
              : {
                  title: tab.title,
                  tabBarIcon: icon(tab.icon, tab.focusedIcon),
                }
          }
        />
      ))}
      <Tabs.Screen name="shelf" options={{ href: null }} />
    </Tabs>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  scanWrap: {
    flex: 1,
    minHeight: touchTarget.min,
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
  scanCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginTop: -22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.actionPrimary,
    borderWidth: borderWidth.ring,
    borderColor: colors.background,
    shadowColor: colors.shadowColor,
    shadowOpacity: shadow.floating.opacity,
    shadowRadius: shadow.floating.radius,
    shadowOffset: shadow.floating.offset,
    elevation: shadow.floating.elevation,
  },
  scanCircleFocused: { backgroundColor: colors.actionPrimaryPressed },
  scanLabel: {
    position: "absolute",
    bottom: spacing.xxs,
  },
  });
}
