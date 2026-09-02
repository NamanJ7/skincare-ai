/**
 * The three places the app actually has.
 *
 * Before this, every screen was a flat stack with no persistent navigation:
 * /plan hid a "Back to today" button in the middle of a scroll, /compare could
 * only be reached through a card inside /plan that appeared once two capture
 * sessions existed, and getting home meant remembering how you arrived.
 *
 * Today is what you do, Plan is what you're on, Progress is whether it worked.
 * Making them tabs means the answer to "where am I and how do I get back" is
 * always on screen, and that Progress — the one surface that tells you the
 * product is working — is discoverable before you have anything to put in it.
 *
 * `Tabs` comes from expo-router/js-tabs: the re-export from `expo-router`
 * itself is deprecated in SDK 56.
 */
import { Tabs } from "expo-router/js-tabs";

import { TabIcon, type TabIconName } from "@/components/TabIcon";
import { colors, spacing, typography } from "@/theme";
import { resolveFontFamily } from "@/theme/fonts";

const TABS: { name: string; title: string; icon: TabIconName }[] = [
  { name: "today", title: "Today", icon: "today" },
  { name: "plan", title: "Plan", icon: "plan" },
  { name: "compare", title: "Progress", icon: "progress" },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.hairline,
          borderTopWidth: 1,
          paddingTop: spacing.xs,
          height: 88,
        },
        // Same face and tracking as the `label` type token, so the tab bar
        // reads as part of the system rather than as platform chrome.
        tabBarLabelStyle: {
          fontFamily: resolveFontFamily(typography.label.family, typography.label.weight),
          fontSize: 12,
          letterSpacing: typography.label.letterSpacing,
          marginTop: spacing.xxs,
        },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <TabIcon name={tab.icon} color={color} focused={focused} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
