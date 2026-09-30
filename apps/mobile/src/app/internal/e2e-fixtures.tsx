import { Redirect } from "expo-router";
import { useState } from "react";
import { Pressable, View } from "react-native";

import {
  buildE2EFixture,
  E2E_FIXTURE_NAMES,
  fixtureRouteAllowed,
  type E2EFixtureName,
} from "@/lib/e2e-fixtures";
import { clearAll, save } from "@/lib/storage";
import { AppText, Screen, spacing, useThemeColors } from "@/theme";

export default function E2EFixtures() {
  const colors = useThemeColors();
  const [status, setStatus] = useState("Choose a fictional state. This replaces local data on this internal build.");

  if (!fixtureRouteAllowed()) return <Redirect href="/" />;

  async function select(name: E2EFixtureName) {
    const fixture = buildE2EFixture(name);
    const cleared = await clearAll();
    const profileSaved = fixture.profile ? await save("profile", fixture.profile) : true;
    const logSaved = fixture.log ? await save("log", fixture.log) : true;
    setStatus(cleared && profileSaved && logSaved
      ? `${name} loaded. Restart the app (or reload this browser tab) to use it.`
      : "Could not save the fixture. Local state may be incomplete.");
  }

  return (
    <Screen contentStyle={{ gap: spacing.md }}>
      <AppText variant="headline">Internal E2E fixtures</AppText>
      <AppText variant="body">{status}</AppText>
      {E2E_FIXTURE_NAMES.map((name) => (
        <Pressable
          key={name}
          testID={`e2e-fixture-${name}`}
          accessibilityRole="button"
          accessibilityLabel={`Load ${name} fixture`}
          onPress={() => void select(name)}
          style={{ padding: spacing.md, backgroundColor: colors.surface, borderRadius: 12 }}
        >
          <View><AppText variant="bodyStrong">{name}</AppText></View>
        </Pressable>
      ))}
    </Screen>
  );
}
