/**
 * Row of links to the legal documents.
 *
 * Navigation only — deliberately carries no "by continuing you agree…"
 * statement, because that would be new legal wording rather than a redesign of
 * the existing text. A real acceptance flow is a legal-review item.
 */
import { router } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, colors, spacing } from "@/theme";

const LINKS = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Use", href: "/legal/terms" },
] as const;

export function LegalLinks({ align = "center" }: { align?: "center" | "left" }) {
  return (
    <View style={[styles.row, align === "center" && styles.center]}>
      {LINKS.map((link, i) => (
        <View key={link.href} style={styles.item}>
          {i > 0 ? (
            <AppText variant="caption" color={colors.hairline} accessible={false}>
              ·
            </AppText>
          ) : null}
          <Pressable
            onPress={() => router.push(link.href)}
            accessibilityRole="link"
            accessibilityLabel={link.label}
            hitSlop={8}
            style={({ pressed }) => [styles.tap, pressed && styles.pressed]}
          >
            <AppText variant="caption" color={colors.primary}>
              {link.label}
            </AppText>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: spacing.xs },
  center: { justifyContent: "center" },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  // Keeps the visible caption small while the tappable area stays comfortable.
  tap: { minHeight: 44, justifyContent: "center" },
  agreement: { textAlign: "center", paddingHorizontal: spacing.md },
  pressed: { opacity: 0.6 },
});

/**
 * Acceptance line shown at the point of account creation.
 *
 * Wording is the standard passive form. Note that nothing records this
 * acceptance yet — there is no auth backend — so this establishes the notice,
 * not an auditable consent record.
 */
export function LegalAgreement({ action = "creating an account" }: { action?: string }) {
  return (
    <AppText variant="caption" color={colors.inkMuted} style={styles.agreement}>
      By {action} you agree to our{" "}
      <AppText
        variant="caption"
        color={colors.primary}
        accessibilityRole="link"
        onPress={() => router.push("/legal/terms")}
      >
        Terms of Use
      </AppText>{" "}
      and{" "}
      <AppText
        variant="caption"
        color={colors.primary}
        accessibilityRole="link"
        onPress={() => router.push("/legal/privacy")}
      >
        Privacy Policy
      </AppText>
      .
    </AppText>
  );
}
