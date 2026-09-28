/**
 * Expandable shelf row: name + category at a glance, verdict badge, and the
 * plain-language reasons on tap. Rows live divider-separated inside one card,
 * matching the Routine tab's step rows. Expansion is plain state — no
 * LayoutAnimation (unreliable alongside reanimated 4 / New Arch).
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ACTIVES, touchTarget, type ThemeColors } from "@pore/shared";
import { UpsellCallout } from "@/components/UpsellCallout";
import { USER_PRODUCT_CATEGORY_LABELS } from "@/lib/labels";
import type { UserProduct } from "@/lib/profile";
import { PRODUCT_IMAGES } from "@/lib/product-images";
import type { ShelfVerdict } from "@/lib/shelf";
import {
  AppText,
  Badge,
  TextButton,
  radius,
  spacing,
  useThemeColors,
  type BadgeTone,
} from "@/theme";

const VERDICT_TONES: Record<ShelfVerdict["status"], BadgeTone> = {
  earned: "primary",
  careful: "caution",
  pause: "escalate",
  unrated: "accent",
};

export function ShelfProductRow({
  product,
  verdict,
  onRemove,
  onEdit,
  onPauseToggle,
  locked = false,
  onOpen,
  onLockedOpen,
}: {
  product: UserProduct;
  verdict: ShelfVerdict;
  onRemove: () => void;
  onEdit?: () => void;
  onPauseToggle?: () => void;
  /**
   * Free tier: three complete "earned" reads each month. Pause/caution safety
   * explanations and unrated guidance always render in full and never consume
   * the quota.
   */
  locked?: boolean;
  /** Records a complete, non-safety compatibility read when details open. */
  onOpen?: () => void;
  onLockedOpen?: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const actives = product.actives ?? [];
  const subtitle = [
    USER_PRODUCT_CATEGORY_LABELS[product.category],
    actives.length > 0
      ? actives.map((a) => ACTIVES[a].label).join(", ")
      : product.ingredientsUnknown
        ? "ingredients unknown"
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => {
          // Fired here rather than inside the updater: `onOpen` records an
          // analytics event and an entitlement write, and React may invoke an
          // updater more than once.
          if (!open) {
            if (locked) onLockedOpen?.();
            else onOpen?.();
          }
          setOpen((current) => !current);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${product.name}, ${verdict.label}${product.pausedAt ? ", paused by you" : ""}`}
        style={styles.head}
      >
        {product.catalogId && PRODUCT_IMAGES[product.catalogId] ? (
          <Image
            source={PRODUCT_IMAGES[product.catalogId]}
            contentFit="contain"
            accessible={false}
            style={styles.productImage}
          />
        ) : null}
        <View style={styles.summary}>
          <AppText variant="bodyStrong">{product.name}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            {subtitle}
          </AppText>
          <View style={styles.badges}>
            <Badge
              label={verdict.label.toUpperCase()}
              tone={VERDICT_TONES[verdict.status]}
            />
            {product.pausedAt ? (
              <Badge label="PAUSED BY YOU" tone="accent" />
            ) : null}
          </View>
        </View>
        <Ionicons
          name={open ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.textSecondary}
        />
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {locked && verdict.status === "earned" ? (
            <UpsellCallout feature="shelf_detail" compact />
          ) : (
            verdict.reasons.map((reason, i) => (
              <AppText key={i} variant="caption" color={colors.textPrimary}>
                {reason}
              </AppText>
            ))
          )}
          <View style={styles.actions}>
            {onPauseToggle ? (
              <TextButton
                label={
                  product.pausedAt
                    ? "Resume this product"
                    : "Pause this product"
                }
                onPress={onPauseToggle}
              />
            ) : null}
            {onEdit ? (
              <TextButton
                label={
                  verdict.status === "unrated"
                    ? "Tag ingredients"
                    : "Edit product"
                }
                onPress={onEdit}
              />
            ) : null}
            <TextButton
              label="Remove product"
              tone={colors.textSecondary}
              onPress={onRemove}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { paddingVertical: spacing.md },
    head: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    productImage: {
      width: 54,
      height: 54,
      borderRadius: radius.sm,
      backgroundColor: colors.background,
    },
    summary: { flex: 1, gap: spacing.xxs },
    badges: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: spacing.xxs,
    },
    body: { gap: spacing.sm, marginTop: spacing.sm },
    actions: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "flex-start",
      gap: spacing.xxs,
    },
  });
}
