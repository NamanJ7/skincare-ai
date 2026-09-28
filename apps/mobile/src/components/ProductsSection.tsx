import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ShelfProductRow } from "@/components/ShelfProductRow";
import { track } from "@/lib/analytics";
import {
  FREE_COMPATIBILITY_CHECKS_PER_MONTH,
  compatibilityAccess,
  compatibilityMonthKey,
  isPremium,
} from "@/lib/gate";
import { buildIntake } from "@/lib/intake";
import { todayKey } from "@/lib/log";
import { routineFor } from "@/lib/plan";
import { shelfVerdict } from "@/lib/shelf";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  Card,
  Divider,
  EmptyState,
  PrimaryButton,
  spacing,
  useThemeColors,
} from "@/theme";
import { Disclaimer } from "./Disclaimer";

export function ProductsSection({
  showDisclaimer = true,
  style,
}: {
  showDisclaimer?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useThemeColors();
  const { data, update } = useOnboarding();
  const { entitlement, recordCompatibilityCheck } = useEntitlement();
  const { log } = useRoutineLog();
  const products = data.userProducts ?? [];
  const today = todayKey();
  const { routine } = useMemo(
    () => routineFor(data, log.revision, today),
    [data, log.revision, today],
  );
  const intake = useMemo(() => buildIntake(data), [data]);
  const premium = isPremium(entitlement);
  const usageCount =
    entitlement.compatibilityUsage?.month === compatibilityMonthKey()
      ? entitlement.compatibilityUsage.productIds.length
      : 0;
  const remaining = Math.max(
    0,
    FREE_COMPATIBILITY_CHECKS_PER_MONTH - usageCount,
  );

  const remove = (id: string) => {
    update({ userProducts: products.filter((product) => product.id !== id) });
  };

  const togglePaused = (id: string) => {
    const pausedAt = new Date().toISOString();
    update({
      userProducts: products.map((product) =>
        product.id === id
          ? {
              ...product,
              pausedAt: product.pausedAt ? undefined : pausedAt,
            }
          : product,
      ),
    });
  };

  return (
    <View style={[styles.section, style]}>
      <View style={styles.intro}>
        <AppText variant="headline">Your products</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Compatibility guidance for what you use.
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {premium
            ? "Plus includes unlimited complete checks."
            : `${remaining} of ${FREE_COMPATIBILITY_CHECKS_PER_MONTH} complete checks left this month. Safety warnings always stay available.`}
        </AppText>
      </View>

      {products.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          mascot="empty"
          title="Your product list starts here"
          body="Add one product to see how it fits your routine."
        />
      ) : (
        <Card elevated style={styles.list}>
          {products.map((product, index) => {
            const verdict = shelfVerdict(product, routine, intake);
            const access = compatibilityAccess(entitlement, product.id);
            // Every caution/pause explanation is safety context, so it remains
            // readable and does not consume a free compatibility check.
            const countsAsCheck = verdict.status === "earned";
            return (
              <View key={product.id}>
                {index > 0 ? <Divider /> : null}
                <ShelfProductRow
                  product={product}
                  verdict={verdict}
                  onRemove={() => remove(product.id)}
                  onEdit={() => router.push(`/add-product?id=${product.id}`)}
                  onPauseToggle={() => togglePaused(product.id)}
                  locked={countsAsCheck && !access.allowed}
                  onOpen={() => {
                    const consumesQuota =
                      !premium && countsAsCheck && !access.alreadyChecked;
                    if (consumesQuota) {
                      recordCompatibilityCheck(product.id);
                    }
                    track("compatibility_check_completed", {
                      status: verdict.status,
                      consumed_quota: consumesQuota,
                      remaining_after: consumesQuota
                        ? Math.max(0, access.remaining - 1)
                        : access.remaining,
                    });
                  }}
                  onLockedOpen={() =>
                    track("compatibility_limit_reached", {
                      monthly_limit: FREE_COMPATIBILITY_CHECKS_PER_MONTH,
                    })
                  }
                />
              </View>
            );
          })}
        </Card>
      )}

      <PrimaryButton
        label="Add a product"
        onPress={() => router.push("/add-product")}
      />

      {showDisclaimer ? <Disclaimer /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: spacing.md,
  },
  intro: {
    gap: spacing.xxs,
  },
  list: {
    gap: 0,
    paddingVertical: spacing.xs,
  },
});
