/** Check-in step 1 of 3: how the skin feels + new breakouts since last time. */
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import type { BreakoutsLevel, SkinFeel } from "@/lib/check-in";
import { track } from "@/lib/analytics";
import { getDraft, updateDraft } from "@/lib/check-in-session";
import { useCheckIns } from "@/state/check-ins";
import { FunnelScreen } from "@/components/FunnelScreen";
import { AppText, OptionRow, spacing } from "@/theme";

const FEEL_OPTIONS: { value: SkinFeel; label: string }[] = [
  { value: 5, label: "Calm and comfortable" },
  { value: 4, label: "Mostly calm" },
  { value: 3, label: "Okay" },
  { value: 2, label: "A bit off" },
  { value: 1, label: "Irritated or uncomfortable" },
];

const BREAKOUT_OPTIONS: { value: BreakoutsLevel; label: string }[] = [
  { value: "none", label: "None new" },
  { value: "few", label: "A few small ones" },
  { value: "several", label: "Several" },
  { value: "widespread", label: "A lot, in more than one area" },
];

export default function CheckInStart() {
  const { checkIns, latest } = useCheckIns();
  const firstTime = checkIns.entries.length === 0;
  const [feel, setFeel] = useState<SkinFeel | undefined>(getDraft().skinFeel);
  const [breakouts, setBreakouts] = useState<BreakoutsLevel | undefined>(getDraft().breakouts);

  // Last week's answers get a badge (not a pre-selection): the form reads as
  // "what changed from this?" while the measurement itself stays unanchored —
  // a pre-filled check-in would bias the very trend data reports are built on.
  const lastWeek = firstTime ? undefined : latest;

  useEffect(() => {
    track("check_in_started", { first_check_in: firstTime });
  }, [firstTime]);

  const next = () => {
    updateDraft({ skinFeel: feel, breakouts });
    router.push("/check-in/signs");
  };

  return (
    <FunnelScreen
      dots={{ count: 3, index: 0 }}
      eyebrow={firstTime ? "Optional skin check-in" : "Weekly check-in"}
      title={firstTime ? "How does your skin feel today?" : "How has your skin felt this week?"}
      titleVariant="titleSans"
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={!feel || !breakouts}
      secondaryLabel="Not now"
      onSecondary={() => router.back()}
    >
      <View style={{ gap: spacing.sm }}>
        {FEEL_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            badge={lastWeek?.skinFeel === opt.value ? "LAST WEEK" : undefined}
            selected={feel === opt.value}
            onPress={() => setFeel(opt.value)}
          />
        ))}
      </View>

      <AppText variant="headline" style={{ marginTop: spacing.sm }}>
        New breakouts since last time?
      </AppText>
      <View style={{ gap: spacing.sm }}>
        {BREAKOUT_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            badge={lastWeek?.breakouts === opt.value ? "LAST WEEK" : undefined}
            selected={breakouts === opt.value}
            onPress={() => setBreakouts(opt.value)}
          />
        ))}
      </View>
    </FunnelScreen>
  );
}
