/**
 * Renders a `LegalDocument` from `@pore/shared/legal` as an in-app screen.
 *
 * These documents used to be `Linking.openURL` calls to pore.skin, a domain
 * that was never registered — so every "Terms of use" tap left the app and
 * landed on a browser error page. Legal text is also exactly the content a
 * reader is most likely to want without a connection, and the consent flows
 * link to it before an account exists. It belongs in the bundle.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { formatLegalDate, type LegalDocument } from "@pore/shared/legal";

import { contactSupport } from "@/lib/contact";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { closeTo } from "@/lib/nav";
import {
  AppText,
  Callout,
  Card,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  spacing,
  useThemeColors,
} from "@/theme";

export function LegalDocumentScreen({ document }: { document: LegalDocument }) {
  const colors = useThemeColors();

  // Matches help.tsx and privacy-controls.tsx: a deep link or a cold start has
  // no stack to pop, so fall back to the surface these documents are reached
  // from rather than leaving the reader on a screen with no way out.
  const close = () => closeTo();

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText variant="titleSans" accessibilityRole="header">
            {document.title}
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {document.lede}
          </AppText>
        </View>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Close ${document.title}`}
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Callout tone="info" title="Dates">
        <AppText variant="caption" color={colors.textPrimary}>
          Effective {formatLegalDate(document.effectiveDate)} · Last updated{" "}
          {formatLegalDate(document.lastUpdated)}
        </AppText>
      </Callout>

      <View style={{ gap: spacing.sm }}>
        {document.intro.map((paragraph, index) => (
          <AppText key={index} color={colors.textSecondary}>
            {paragraph}
          </AppText>
        ))}
      </View>

      {document.sections.map((section) => (
        <View key={section.id} style={{ gap: spacing.sm }}>
          <SectionHeader title={section.heading} />
          {section.body.map((paragraph, index) => (
            <AppText key={index} color={colors.textSecondary}>
              {paragraph}
            </AppText>
          ))}
          {section.bullets?.map((bullet, index) => (
            <View
              key={index}
              style={{ flexDirection: "row", gap: spacing.sm, paddingLeft: spacing.xs }}
            >
              <AppText color={colors.textSecondary}>{"•"}</AppText>
              <AppText color={colors.textSecondary} style={{ flex: 1 }}>
                {bullet}
              </AppText>
            </View>
          ))}
        </View>
      ))}

      <SectionHeader title="Questions" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="chatbubble-ellipses-outline"
          label="Send feedback"
          detail="Ask a question or report a problem"
          onPress={() => router.push("/feedback")}
        />
        <Divider />
        <ListRow
          icon="mail-outline"
          label="Contact Pore"
          detail={SUPPORT_EMAIL}
          onPress={() => void contactSupport()}
        />
      </Card>

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Pore provides skincare education and routine guidance and is not a
        substitute for professional medical advice.
      </AppText>
    </Screen>
  );
}
