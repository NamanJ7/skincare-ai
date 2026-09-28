/** Check-in step 2 of 3: irritation signs (multi-select, plain English). */
import { Redirect, router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";

import type { IrritationSign } from "@/lib/check-in";
import { getDraft, updateDraft } from "@/lib/check-in-session";
import { FunnelScreen } from "@/components/FunnelScreen";
import { OptionRow, spacing } from "@/theme";

const SIGN_OPTIONS: { value: IrritationSign; label: string; hint?: string }[] =
  [
    { value: "redness", label: "Redness" },
    { value: "itching", label: "Itching" },
    {
      value: "stinging",
      label: "Mild stinging",
      hint: "e.g. right after applying products",
    },
    { value: "dryness_flaking", label: "Dryness or flaking" },
    { value: "burning", label: "Burning or severe stinging" },
    { value: "pain", label: "Painful to the touch" },
    { value: "spreading_rash", label: "A rash that's spreading" },
  ];

export default function CheckInSigns() {
  const draft = getDraft();
  const [signs, setSigns] = useState<IrritationSign[]>(
    draft.irritationSigns ?? [],
  );
  const [none, setNone] = useState(false);

  // Deep link straight here shouldn't dead-end — restart the flow instead.
  if (!draft.skinFeel || !draft.breakouts) {
    return <Redirect href="/check-in" />;
  }

  const toggleSign = (sign: IrritationSign) => {
    setNone(false);
    setSigns((prev) =>
      prev.includes(sign) ? prev.filter((s) => s !== sign) : [...prev, sign],
    );
  };

  const selectNone = () => {
    setNone(true);
    setSigns([]);
  };

  const next = () => {
    updateDraft({ irritationSigns: signs });
    router.push("/check-in/wrap-up");
  };

  return (
    <FunnelScreen
      dots={{ count: 3, index: 1 }}
      eyebrow="Weekly check-in"
      title="Any of these this week?"
      titleVariant="titleSans"
      subtitle="Pick what applies."
      primaryLabel="Continue"
      onPrimary={next}
      primaryDisabled={signs.length === 0 && !none}
    >
      <View style={{ gap: spacing.sm }}>
        {SIGN_OPTIONS.map((opt) => (
          <OptionRow
            key={opt.value}
            label={opt.label}
            hint={opt.hint}
            multi
            selected={signs.includes(opt.value)}
            onPress={() => toggleSign(opt.value)}
          />
        ))}
        <OptionRow
          label="None of these"
          multi
          selected={none}
          onPress={selectNone}
        />
      </View>
    </FunnelScreen>
  );
}
