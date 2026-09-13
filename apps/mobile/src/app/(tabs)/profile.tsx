/** Profile is the single home for plan controls, preferences, help, and privacy. */
import { router } from "expo-router";
import { useRef, useState } from "react";
import { View } from "react-native";

import { ageTierFor } from "@pore/shared";

import { deleteAccount } from "@/lib/api";
import { track } from "@/lib/analytics";
import { isPremium, scanAccess } from "@/lib/gate";
import { contactSupport } from "@/lib/contact";
import { confirm, notify } from "@/lib/dialogs";
import {
  CLIMATE_LABELS,
  GOAL_LABELS,
  SENSITIVITY_LABELS,
  SKIN_TYPE_LABELS,
} from "@/lib/labels";
import { PRIVACY_ROUTE, SUPPORT_EMAIL, TERMS_ROUTE } from "@/lib/legal";
import { scanEntryHref } from "@/lib/nav";
import { deleteAllPhotos } from "@/lib/photos";
import { formatReminderTime } from "@/lib/reminders";
import {
  calibrationLogSize,
  clearCalibrationLog,
} from "@/lib/scan/calibration-log";
import { shareCalibrationLog } from "@/lib/scan/share-calibration-log";
import { shareBetaMetrics } from "@/lib/share-beta-metrics";
import { clearAll } from "@/lib/storage";
import { BACKEND_CONFIGURED } from "@/lib/backend/supabase";
import { useCheckIns } from "@/state/check-ins";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useSession } from "@/state/session";
import { useReminders } from "@/state/reminders";
import { useRoutineLog } from "@/state/routine-log";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Card,
  Chip,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  spacing,
  type AppearancePreference,
  useTheme,
} from "@/theme";

const APPEARANCE_OPTIONS = [
  {
    value: "system",
    label: "System",
    icon: "phone-portrait-outline",
    detail: "Follow this device's appearance",
  },
  {
    value: "light",
    label: "Light",
    icon: "sunny-outline",
    detail: "Warm ivory surfaces",
  },
  {
    value: "dark",
    label: "Dark",
    icon: "moon-outline",
    detail: "Soft charcoal surfaces",
  },
] as const satisfies readonly {
  value: AppearancePreference;
  label: string;
  icon: "phone-portrait-outline" | "sunny-outline" | "moon-outline";
  detail: string;
}[];

export default function ProfileTab() {
  const { colors, preference, mode, setPreference } = useTheme();
  const [calibrationSize, setCalibrationSize] = useState(() =>
    calibrationLogSize(),
  );
  const [deleting, setDeleting] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [pendingAppearance, setPendingAppearance] =
    useState<AppearancePreference | null>(null);
  const deleteInFlight = useRef(false);
  const resetInFlight = useRef(false);
  const appearanceInFlight = useRef(false);
  const [sharingDiagnostics, setSharingDiagnostics] = useState(false);
  const [sharingCalibration, setSharingCalibration] = useState(false);
  const [diagnosticsDetail, setDiagnosticsDetail] = useState(
    "Privacy-safe event history; no photos, email, or skin notes",
  );
  const { data, reset } = useOnboarding();
  const session = useSession();
  const { entitlement, clear: clearEntitlement } = useEntitlement();
  const { clear: clearLog } = useRoutineLog();
  const { clear: clearCheckIns } = useCheckIns();
  const { history, clear: clearScanHistory } = useScanHistory();
  const { prefs, clear: clearReminders } = useReminders();

  const premium = isPremium(entitlement);
  const agePrivacyDetail =
    data.age === undefined
      ? "Age not set"
      : ageTierFor(data.age) === "young_teen"
        ? "Parent authorization active"
        : ageTierFor(data.age) === "older_teen"
          ? "Teen privacy consent active"
          : "Adult privacy choices";
  const access = scanAccess(entitlement, data, history);
  const reminderSummary = (() => {
    if (!prefs.optIn) return "Off";
    const parts: string[] = [];
    if (prefs.am.enabled) {
      parts.push(
        `AM ${formatReminderTime(prefs.am.hour, prefs.am.minute).replace(/ (AM|PM)$/, "")}`,
      );
    }
    if (prefs.pm.enabled) {
      parts.push(
        `PM ${formatReminderTime(prefs.pm.hour, prefs.pm.minute).replace(/ (AM|PM)$/, "")}`,
      );
    }
    return parts.length > 0 ? parts.join(" · ") : "Off";
  })();

  const goals = data.goals ?? [];
  const orderedGoals = data.primaryGoal
    ? [data.primaryGoal, ...goals.filter((goal) => goal !== data.primaryGoal)]
    : goals;

  const retake = async () => {
    if (resetInFlight.current) return;
    const confirmed = await confirm({
      title: "Retake the questionnaire?",
      message:
        "Your answers and plan will reset. Your routine and progress history stay.",
      confirmLabel: "Retake",
      destructive: true,
    });
    if (!confirmed || resetInFlight.current) return;
    resetInFlight.current = true;
    setResetting(true);
    const removed = await reset();
    resetInFlight.current = false;
    setResetting(false);
    if (!removed) {
      notify(
        "Could not restart the questionnaire",
        "Pore could not save this change on your device. Please try again.",
      );
      return;
    }
    router.replace("/onboarding/age");
  };

  /**
   * Wipe everything Pore stores on this device. Shared by the local-only
   * "Delete my data" path and by account deletion, which runs it only *after*
   * the server confirms — clearing the phone while the cloud copy survives is
   * the exact outcome account deletion exists to prevent.
   */
  const wipeLocalData = async () => {
    const cleared = await clearAll();
    const photosDeleted = deleteAllPhotos();
    if (!cleared || !photosDeleted) throw new Error("device-data-clear-failed");
    const profileReset = await reset();
    if (!profileReset) throw new Error("profile-reset-failed");
    clearLog();
    clearCheckIns();
    clearScanHistory();
    clearEntitlement();
    clearReminders();
  };

  const deleteData = async () => {
    if (deleteInFlight.current) return;
    const confirmed = await confirm({
      title: "Delete my data?",
      message:
        "This removes your profile, plan, saved photos, history, reminders, diagnostics, and local Plus status from this device.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!confirmed || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeleting(true);
    try {
      await wipeLocalData();
      router.replace("/");
    } catch {
      deleteInFlight.current = false;
      setDeleting(false);
      notify(
        "Data deletion could not finish",
        "Some local data may already be gone, but Pore could not verify complete deletion. Please try again to finish.",
      );
    }
  };

  /**
   * Permanent account deletion (App Store guideline 5.1.1(v)). Server first,
   * device second: if the server call fails we report it honestly and leave
   * local data intact rather than half-deleting the account.
   */
  const deleteAccountAndData = async () => {
    if (deleteInFlight.current) return;
    const confirmed = await confirm({
      title: "Delete your account?",
      message:
        "This permanently deletes your Pore account and everything in it — profile, scans, photos, routine, and history — from this device and from Pore's servers. This cannot be undone.",
      confirmLabel: "Delete account",
      destructive: true,
    });
    if (!confirmed || deleteInFlight.current) return;
    deleteInFlight.current = true;
    setDeletingAccount(true);
    track("account_deletion_requested");
    const outcome = await deleteAccount();
    if (outcome.status !== "ok") {
      deleteInFlight.current = false;
      setDeletingAccount(false);
      notify(
        "Could not delete your account",
        outcome.status === "unconfigured"
          ? "Account deletion is not available in this build. Contact Pore support and your account will be removed."
          : "Your account and data were not deleted. Check your connection and try again, or contact Pore support.",
      );
      return;
    }
    try {
      await wipeLocalData();
      await session.signOut();
      track("account_deletion_completed");
      router.replace("/");
    } catch {
      deleteInFlight.current = false;
      setDeletingAccount(false);
      // The server side succeeded, so the account really is gone. Say
      // exactly that rather than implying the deletion failed.
      notify(
        "Account deleted, but this device still holds a copy",
        "Your Pore account and its cloud data were deleted. Some data on this phone could not be removed — use Delete my data to finish.",
      );
    }
  };

  const signOut = async () => {
    const confirmed = await confirm({
      title: "Sign out?",
      message:
        "Your data stays on this phone. Cloud backup pauses until you sign in again.",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (confirmed) await session.signOut();
  };

  const clearCalibration = async () => {
    const confirmed = await confirm({
      title: "Clear calibration log?",
      message: "This removes the current in-memory QA samples.",
      confirmLabel: "Clear",
      destructive: true,
    });
    if (!confirmed) return;
    clearCalibrationLog();
    setCalibrationSize(0);
  };

  const changeAppearance = async (next: AppearancePreference) => {
    if (next === preference || appearanceInFlight.current) return;
    appearanceInFlight.current = true;
    setPendingAppearance(next);
    const persisted = await setPreference(next);
    appearanceInFlight.current = false;
    setPendingAppearance(null);
    if (!persisted) {
      notify(
        "Appearance could not be saved",
        "Pore kept your previous appearance. Please try again.",
      );
    }
  };

  const exportDiagnostics = async () => {
    if (sharingDiagnostics) return;
    setSharingDiagnostics(true);
    try {
      const count = await shareBetaMetrics();
      setDiagnosticsDetail(
        `Share sheet opened with ${count} privacy-safe ${count === 1 ? "event" : "events"}`,
      );
    } catch {
      notify(
        "Could not share diagnostics",
        "Your data stayed on this device. Please try again.",
      );
    } finally {
      setSharingDiagnostics(false);
    }
  };

  const exportCalibration = async () => {
    if (sharingCalibration) return;
    setSharingCalibration(true);
    try {
      await shareCalibrationLog();
    } catch {
      notify(
        "Could not export the calibration log",
        "Nothing was shared. Please try again.",
      );
    } finally {
      setSharingCalibration(false);
    }
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="titleSans">Profile</AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          Your plan, preferences, help, and privacy controls.
        </AppText>
      </View>

      <SectionHeader title="Your skin profile" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {data.skinType ? (
          <Chip label={SKIN_TYPE_LABELS[data.skinType]} selected />
        ) : null}
        {data.sensitivity ? (
          <Chip
            label={SENSITIVITY_LABELS[data.sensitivity]}
            selected
            tone="lavender"
          />
        ) : null}
        {data.climate ? <Chip label={CLIMATE_LABELS[data.climate]} /> : null}
        {orderedGoals.map((goal) => (
          <Chip key={goal} label={GOAL_LABELS[goal]} />
        ))}
      </View>

      <SectionHeader title="Plan" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="create-outline"
          label="Edit profile"
          detail="Change your answers"
          onPress={() => router.push("/edit-profile")}
        />
        <Divider />
        <ListRow
          icon="refresh-outline"
          label={resetting ? "Restarting questionnaire…" : "Retake questionnaire"}
          detail={resetting ? "Saving your reset" : "Rebuild your plan from scratch"}
          onPress={() => void retake()}
          disabled={resetting}
        />
        <Divider />
        {access.allowed ? (
          <ListRow
            icon="scan-outline"
            label="Re-scan my skin"
            detail={
              access.reason === "first_weekly_comparison"
                ? "Your included seven-day comparison"
                : data.scannedAt
                  ? "Continue your weekly progress scan"
                  : "Add a scan to your plan"
            }
            onPress={() => router.push(scanEntryHref(data, "rescan"))}
          />
        ) : access.reason === "cadence_wait" ? (
          <ListRow
            icon="scan-outline"
            label="Next weekly scan"
            detail={`Available in ${access.daysUntilAvailable} ${access.daysUntilAvailable === 1 ? "day" : "days"}`}
            disabled
          />
        ) : (
          <ListRow
            icon="scan-outline"
            label="Re-scan my skin"
            detail="Part of Pore Plus"
            badge="PLUS"
            onPress={() => router.push("/paywall?feature=rescan")}
          />
        )}
      </Card>

      <SectionHeader title="Appearance" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        {APPEARANCE_OPTIONS.map((option, index) => (
          <View key={option.value}>
            {index > 0 ? <Divider /> : null}
            <ListRow
              icon={option.icon}
              label={option.label}
              detail={
                pendingAppearance === option.value
                  ? "Saving appearance…"
                  : option.value === "system"
                    ? `${option.detail} · currently ${mode}`
                    : option.detail
              }
              badge={preference === option.value ? "ACTIVE" : undefined}
              trailing={preference === option.value ? "none" : "chevron"}
              onPress={() => void changeAppearance(option.value)}
              disabled={pendingAppearance !== null}
            />
          </View>
        ))}
      </Card>

      <SectionHeader title="Preferences" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        {BACKEND_CONFIGURED ? (
          <>
            {session.status === "signedIn" ? (
              <ListRow
                icon="person-circle-outline"
                label="Account"
                detail={session.email ?? "Signed in"}
                onPress={() => void signOut()}
              />
            ) : (
              <ListRow
                icon="person-circle-outline"
                label="Create account"
                detail="Back up your routine, scans, and progress"
                onPress={() => router.push("/sign-up")}
              />
            )}
            <Divider />
          </>
        ) : null}
        <ListRow
          icon="notifications-outline"
          label="Reminders"
          detail={reminderSummary}
          onPress={() => router.push("/reminders")}
        />
        <Divider />
        {premium ? (
          <ListRow
            icon="card-outline"
            label="Pore Plus"
            detail={`Active · ${entitlement.term === "annual" ? "Annual" : entitlement.term === "monthly" ? "Monthly" : "Access"}`}
            badge="PLUS"
            trailing="none"
          />
        ) : (
          <ListRow
            icon="card-outline"
            label="Pore Plus"
            detail="Free plan · Learn about Plus"
            onPress={() => router.push("/paywall")}
          />
        )}
      </Card>

      <SectionHeader title="Learn & support" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="play-circle-outline"
          label="Replay the Pore promise"
          detail="A quick visual guide to photos, safety, and routines"
          onPress={() => router.push("/onboarding/intro?replay=1")}
        />
        <Divider />
        <ListRow
          icon="help-circle-outline"
          label="Help & education"
          detail="How Pore works and when to seek care"
          onPress={() => router.push("/help")}
        />
        <Divider />
        <ListRow
          icon="chatbubble-ellipses-outline"
          label="Send feedback"
          detail="Report a problem or suggest an improvement"
          onPress={() => router.push("/feedback")}
        />
      </Card>

      {__DEV__ ? (
        <>
          <SectionHeader title="Scan QA (development)" />
          <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
            <ListRow
              icon="share-outline"
              label="Export calibration log"
              detail={
                sharingCalibration
                  ? "Opening share sheet…"
                  : `${calibrationSize} JSONL samples · no photos or pixels`
              }
              onPress={() => void exportCalibration()}
              disabled={sharingCalibration}
            />
            <Divider />
            <ListRow
              icon="close-circle-outline"
              label="Clear calibration log"
              detail="Start a clean device sweep"
              onPress={() => void clearCalibration()}
            />
          </Card>
        </>
      ) : null}

      <SectionHeader title="Privacy & data" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="images-outline"
          label="Photo & privacy controls"
          detail="Consent, saved photos, and deletion choices"
          onPress={() => router.push("/privacy-controls")}
        />
        <Divider />
        <ListRow
          icon="shield-checkmark-outline"
          label="Age & privacy"
          detail={agePrivacyDetail}
          onPress={() =>
            router.push({
              pathname: "/onboarding/age",
              params: { edit: "1", returnTo: "/(tabs)/profile" },
            })
          }
        />
        <Divider />
        <ListRow
          icon="document-text-outline"
          label="Privacy notice"
          detail="How Pore handles photos, answers, and youth consent"
          onPress={() => router.push(PRIVACY_ROUTE)}
        />
        <Divider />
        <ListRow
          icon="reader-outline"
          label="Terms of use"
          detail="Cosmetic guidance and responsible-use terms"
          onPress={() => router.push(TERMS_ROUTE)}
        />
        <Divider />
        <ListRow
          icon="analytics-outline"
          label="Share diagnostics"
          detail={sharingDiagnostics ? "Opening share sheet…" : diagnosticsDetail}
          onPress={() => void exportDiagnostics()}
          disabled={sharingDiagnostics}
        />
        <Divider />
        <ListRow
          icon="mail-outline"
          label="Contact Pore"
          detail={SUPPORT_EMAIL}
          onPress={() => void contactSupport()}
        />
        <Divider />
        <ListRow
          icon="trash-outline"
          label={deleting ? "Deleting my data…" : "Delete my data"}
          detail={
            session.status === "signedIn"
              ? "Everything on this device · your account stays"
              : "Everything stored by Pore on this device"
          }
          onPress={() => void deleteData()}
          disabled={deleting || deletingAccount}
          tone={colors.error}
        />
        {session.status === "signedIn" ? (
          <>
            <Divider />
            <ListRow
              icon="person-remove-outline"
              label={
                deletingAccount ? "Deleting account…" : "Delete my account"
              }
              detail="Permanently deletes your account and cloud data"
              onPress={() => void deleteAccountAndData()}
              disabled={deleting || deletingAccount}
              tone={colors.error}
            />
          </>
        ) : null}
      </Card>

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Pore v1.0 · Cosmetic guidance only.
      </AppText>
    </Screen>
  );
}
