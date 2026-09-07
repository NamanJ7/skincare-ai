/**
 * Every check-in on this device, and a way to remove any one of them.
 *
 * History accumulates on purpose now — it is what makes progress meaningful —
 * which means the app is holding a growing pile of someone's face photos. An
 * all-or-nothing wipe is not a real answer to that, so each visit can go on its
 * own, photos and findings together.
 */
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

import { deleteCheckIn, listCheckIns, loadPlan, type CheckInSummary } from "@/lib/plan";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, Divider, GhostButton, Screen, colors, spacing } from "@/theme";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function History() {
  const { update, reset } = useOnboarding();
  const [checkIns, setCheckIns] = useState<CheckInSummary[]>(() => listCheckIns());

  function confirmDelete(entry: CheckInSummary) {
    Alert.alert(
      `Delete the ${formatDate(entry.savedAt)} check-in?`,
      "This removes that visit's photos and what we noticed, from this phone. Your other check-ins stay.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteCheckIn(entry.sessionId);
            const remaining = listCheckIns();
            setCheckIns(remaining);

            // Deleting the check-in that produced the routine on Today has to
            // move Today too, or the screen keeps showing findings the user
            // just asked us to forget.
            const latest = loadPlan();
            if (latest) {
              update({ ...latest.intake, sessionId: latest.sessionId, plan: latest.plan });
            } else if (remaining.length === 0) {
              reset();
              router.replace("/");
            }
          },
        },
      ],
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <GhostButton label="Back" onPress={() => router.back()} />
      <AppText variant="label" color={colors.primary}>
        HISTORY
      </AppText>
      <AppText variant="title">Your check-ins</AppText>

      {checkIns.length === 0 ? (
        <AppText variant="body" color={colors.inkMuted}>
          Nothing saved on this phone yet.
        </AppText>
      ) : (
        <Card>
          {checkIns.map((entry, i) => (
            <View key={entry.sessionId} style={{ gap: spacing.xs }}>
              {i > 0 && <Divider />}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View style={{ flexShrink: 1 }}>
                  <AppText variant="bodyStrong">{formatDate(entry.savedAt)}</AppText>
                  {i === 0 ? (
                    <AppText variant="caption" color={colors.primary}>
                      Current routine
                    </AppText>
                  ) : null}
                </View>
                <GhostButton label="Delete" onPress={() => confirmDelete(entry)} />
              </View>
            </View>
          ))}
        </Card>
      )}

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          Everything here is stored on this phone, inside the app. It was never uploaded to an
          account — there isn&apos;t one.
        </AppText>
      </Card>
    </Screen>
  );
}
