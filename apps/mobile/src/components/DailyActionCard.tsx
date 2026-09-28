/**
 * The one thing Pore asks for today. Holds Home's single PrimaryButton; the
 * done state renders the completion moment instead of another task.
 */
import { router } from "expo-router";

import type { DailyAction } from "@/lib/daily-action";
import { AppText, Card, PrimaryButton, spacing, useThemeColors } from "@/theme";
import { RoutineComplete } from "./RoutineComplete";

export function DailyActionCard({ action }: { action: DailyAction }) {
  const colors = useThemeColors();
  if (action.kind === "done") {
    return (
      <Card>
        <RoutineComplete body={action.body} />
      </Card>
    );
  }
  return (
    <Card style={{ gap: spacing.sm }}>
      <AppText variant="overline" color={colors.actionPrimary}>
        TODAY&apos;S ACTION
      </AppText>
      <AppText variant="headline">{action.title}</AppText>
      <AppText variant="body" color={colors.textSecondary}>
        {action.body}
      </AppText>
      {action.cta && action.href ? (
        <PrimaryButton
          label={action.cta}
          onPress={() => router.push(action.href!)}
        />
      ) : null}
    </Card>
  );
}
