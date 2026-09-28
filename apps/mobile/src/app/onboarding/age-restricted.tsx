import { router } from "expo-router";

import { SUPPORT_EMAIL } from "@/lib/legal";
import { contactSupport } from "@/lib/contact";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

export default function AgeRestricted() {
  const colors = useThemeColors();
  const { update } = useOnboarding();

  const changeAge = () => {
    update({
      age: undefined,
      guardianAuthorization: undefined,
      teenSelfConsent: undefined,
      photoAnalysisConsent: undefined,
    });
    router.replace("/onboarding/age");
  };

  return (
    <Screen
      scroll={false}
      contentStyle={{
        justifyContent: "center",
        gap: spacing.lg,
        paddingTop: spacing.section,
      }}
    >
      <AppText variant="overline" color={colors.actionPrimary}>
        AGE REQUIREMENT
      </AppText>
      <AppText variant="title">Pore is designed for ages 13 and up</AppText>
      <AppText variant="body" color={colors.textSecondary}>
        We do not create profiles, collect questionnaire answers, or accept face
        photos from children under 13 at launch.
      </AppText>
      <Callout tone="info" icon="shield-checkmark-outline" title="Why access stops here">
        <AppText variant="caption" color={colors.textPrimary}>
          Supporting younger children requires a separate parent notice,
          verifiable parental-consent service, parent access and deletion tools,
          and stricter data operations. Pore will not pretend those safeguards
          exist before they are fully available.
        </AppText>
      </Callout>
      <TextButton
        label="Change age"
        onPress={changeAge}
      />
      <TextButton
        label="Contact Pore"
        onPress={() => void contactSupport()}
      />
      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Questions for a parent or guardian: {SUPPORT_EMAIL}
      </AppText>
    </Screen>
  );
}
