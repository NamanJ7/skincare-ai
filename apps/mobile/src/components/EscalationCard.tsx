/**
 * Calm professional-care nudge, shown when a check-in or scan assessment
 * raises a red flag. Deliberately quiet styling (tinted clay callout, no alarm
 * language) — credibility comes from knowing when to step back.
 */
import { AppText, Callout, useThemeColors } from "@/theme";

export function EscalationCard({
  reasons,
  hasStrongActives = false,
  reasonSource = "reported",
}: {
  reasons: string[];
  hasStrongActives?: boolean;
  reasonSource?: "reported" | "scan";
}) {
  const colors = useThemeColors();
  return (
    <Callout tone="escalate" title="Worth a professional look">
      {reasons.length > 0 ? (
        <AppText variant="body" color={colors.textPrimary}>
          {reasonSource === "scan"
            ? "Pore's scan review flagged"
            : "You mentioned"}
          : {reasons.join(", ")}.
        </AppText>
      ) : null}
      <AppText variant="body" color={colors.textPrimary}>
        This may need care beyond Pore. Consider a dermatologist or healthcare
        professional.
      </AppText>
      {hasStrongActives ? (
        <AppText variant="body" color={colors.textPrimary}>
          Pause strong actives until things feel settled.
        </AppText>
      ) : null}
      <AppText variant="caption" color={colors.textSecondary}>
        Cosmetic guidance, not medical advice.
      </AppText>
    </Callout>
  );
}
