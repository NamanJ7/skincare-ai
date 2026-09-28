import * as Haptics from "expo-haptics";
import { Redirect, router, useLocalSearchParams, type Href } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from "react-native";

import { ageTierFor, type ThemeColors } from "@pore/shared";

import { FunnelScreen } from "@/components/FunnelScreen";
import { track } from "@/lib/analytics";
import { notify } from "@/lib/dialogs";
import { funnelProgress } from "@/lib/funnel-progress";
import { verifyGuardianPin } from "@/lib/guardian-pin";
import { profileAuthorizationHref } from "@/lib/nav";
import { ONBOARDING_ROUTES } from "@/lib/onboarding-tour";
import { safeInternalHref } from "@/lib/route-access";
import { hasCurrentGuardianAuthorization } from "@/lib/youth-consent";
import { useOnboarding } from "@/state/onboarding";
import { AppText, TextField, radius, spacing, useThemeColors } from "@/theme";

const MIN_AGE = 1;
const MAX_AGE = 100;
const AGES = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, index) => MIN_AGE + index,
);
const ITEM_HEIGHT = 58;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
const WHEEL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

export default function AgeGate() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data, update } = useOnboarding();
  const { edit, returnTo } = useLocalSearchParams<{
    edit?: string;
    returnTo?: string;
  }>();
  const editing = edit === "1";
  const safeReturnTo = safeInternalHref(returnTo, "/(tabs)/profile") as Href;
  const initialAge = Math.min(MAX_AGE, Math.max(MIN_AGE, data.age ?? 25));
  const [age, setAge] = useState(initialAge);
  const listRef = useRef<FlatList<number>>(null);
  const lastAge = useRef(initialAge);
  const [guardianPin, setGuardianPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  // Only a completed minor profile needs guardian approval to change its age.
  // During onboarding, someone must be able to correct a mistaken teen age to
  // their real adult age without carrying a stale guardian gate forward.
  const requiresGuardianPin = Boolean(
    data.onboardingComplete &&
    hasCurrentGuardianAuthorization(data.age, data.guardianAuthorization),
  );

  useEffect(() => {
    if (!editing) track("onboarding_step_viewed", { step_id: "age" });
  }, [editing]);

  if (data.age !== undefined && data.age < 13 && !editing) {
    return <Redirect href="/onboarding/age-restricted" />;
  }

  function selectFromOffset(offset: number) {
    const index = Math.max(
      0,
      Math.min(AGES.length - 1, Math.round(offset / ITEM_HEIGHT)),
    );
    const next = AGES[index];
    if (next !== lastAge.current) {
      lastAge.current = next;
      setAge(next);
    }
  }

  function selectAge(next: number) {
    const index = next - MIN_AGE;
    lastAge.current = next;
    setAge(next);
    listRef.current?.scrollToIndex({ index, animated: true });
    Haptics.selectionAsync().catch(() => {});
  }

  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    selectFromOffset(event.nativeEvent.contentOffset.y);
  }

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    selectFromOffset(event.nativeEvent.contentOffset.y);
    Haptics.selectionAsync().catch(() => {});
  }

  async function onContinue() {
    const selectedAge = age;
    setSaving(true);
    if (requiresGuardianPin && data.guardianAuthorization) {
      setPinError(null);
      const verified = await verifyGuardianPin(
        guardianPin,
        data.guardianAuthorization.guardianCredential,
      ).catch(() => false);
      if (!verified) {
        setPinError("That guardian PIN is not correct.");
        setSaving(false);
        return;
      }
    }

    const previousTier =
      data.age === undefined ? undefined : ageTierFor(data.age);
    const nextTier = ageTierFor(selectedAge);
    const changedTier = previousTier !== undefined && previousTier !== nextTier;
    if (nextTier === "under_13" && data.onboardingComplete) {
      setSaving(false);
      notify(
        "Delete this profile first",
        "Changing an existing profile to an under-13 age must remove its answers, scans, and history. Delete app data in Profile, then start again with the correct age.",
      );
      return;
    }
    const nextData = {
      ...data,
      age: selectedAge,
      ...(changedTier
        ? {
            teenSelfConsent: undefined,
            guardianAuthorization: undefined,
            photoAnalysisConsent: undefined,
          }
        : {}),
    };
    const persisted = await update({
      age: selectedAge,
      ...(changedTier
        ? {
            teenSelfConsent: undefined,
            guardianAuthorization: undefined,
            photoAnalysisConsent: undefined,
          }
        : {}),
    });
    if (!persisted) {
      setSaving(false);
      notify(
        "Couldn't save your age",
        "Pore couldn't save on this device. Please try again.",
      );
      return;
    }

    if (!editing) track("onboarding_step_completed", { step_id: "age" });

    if (nextTier === "under_13") {
      router.replace("/onboarding/age-restricted");
      return;
    }

    const required = profileAuthorizationHref(nextData);
    if (required) {
      router.replace(
        (editing
          ? `${required}?returnTo=${encodeURIComponent(String(safeReturnTo))}`
          : required) as Href,
      );
      return;
    }
    if (editing) {
      if (router.canGoBack()) router.back();
      else router.replace(safeReturnTo);
    } else router.replace(ONBOARDING_ROUTES.goal);
  }

  function goBack() {
    if (!editing) track("onboarding_step_backed_out", { step_id: "age" });
    router.back();
  }

  return (
    <FunnelScreen
      progress={editing ? undefined : funnelProgress("age")}
      title="How old are you?"
      subtitle="Scroll to your exact age. Pore uses it to show the right privacy choices and personalize age-relevant guidance."
      primaryLabel={editing ? "Save" : "Continue"}
      primaryLoading={saving}
      primaryDisabled={requiresGuardianPin && guardianPin.length !== 4}
      onPrimary={() => void onContinue()}
      secondaryLabel={editing ? undefined : "Back"}
      onSecondary={goBack}
      scroll={false}
    >
      <View style={styles.wheelWrap}>
        <View pointerEvents="none" style={styles.selection} />
        <View pointerEvents="none" style={styles.topFade} />
        <View pointerEvents="none" style={styles.bottomFade} />
        <FlatList
          ref={listRef}
          data={AGES}
          keyExtractor={(item) => String(item)}
          initialScrollIndex={initialAge - MIN_AGE}
          getItemLayout={(_, index) => ({
            length: ITEM_HEIGHT,
            offset: ITEM_HEIGHT * index,
            index,
          })}
          contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
          renderItem={({ item }) => {
            const distance = Math.abs(item - age);
            return (
              <Pressable
                onPress={() => selectAge(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item} years old`}
                accessibilityState={{ selected: item === age }}
                style={({ pressed }) => [
                  styles.ageRow,
                  pressed && styles.ageRowPressed,
                ]}
              >
                <AppText
                  variant={item === age ? "stat" : "bodyStrong"}
                  color={
                    item === age
                      ? colors.actionPrimary
                      : distance === 1
                        ? colors.textSecondary
                        : colors.border
                  }
                  style={item === age ? styles.selectedAge : undefined}
                >
                  {item}
                </AppText>
                {item === age ? (
                  <AppText variant="caption" color={colors.textSecondary}>
                    years old
                  </AppText>
                ) : null}
              </Pressable>
            );
          }}
          showsVerticalScrollIndicator={false}
          snapToInterval={ITEM_HEIGHT}
          decelerationRate="fast"
          scrollEventThrottle={16}
          onScroll={onScroll}
          onMomentumScrollEnd={onScrollEnd}
          onScrollEndDrag={onScrollEnd}
          style={styles.wheel}
          accessibilityRole="adjustable"
          accessibilityLabel="Age"
          accessibilityValue={{ min: MIN_AGE, max: MAX_AGE, now: age }}
          accessibilityActions={[
            { name: "increment", label: "Increase age" },
            { name: "decrement", label: "Decrease age" },
          ]}
          onAccessibilityAction={({ nativeEvent }) => {
            if (nativeEvent.actionName === "increment") {
              selectAge(Math.min(MAX_AGE, age + 1));
            }
            if (nativeEvent.actionName === "decrement") {
              selectAge(Math.max(MIN_AGE, age - 1));
            }
          }}
        />
      </View>

      <AppText
        variant="caption"
        color={colors.actionPrimary}
        style={{ textAlign: "center" }}
      >
        Scroll the wheel or tap any age to select it.
      </AppText>

      {requiresGuardianPin ? (
        <View style={{ gap: spacing.xs }}>
          <TextField
            label="Guardian PIN"
            value={guardianPin}
            onChangeText={(value) => {
              setGuardianPin(value.replace(/\D/g, "").slice(0, 4));
              setPinError(null);
            }}
            placeholder="••••"
            keyboardType="number-pad"
            secureTextEntry
            maxLength={4}
          />
          <AppText variant="caption" color={colors.textSecondary}>
            The parent or guardian who authorized Pore must approve an age
            change.
          </AppText>
          {pinError ? (
            <AppText variant="caption" color={colors.error}>
              {pinError}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Age sets the privacy flow. Your goals, sensitivity, products, and
        optional scan drive your routine.
      </AppText>
    </FunnelScreen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wheelWrap: {
      height: WHEEL_HEIGHT,
      marginTop: spacing.sm,
      borderRadius: radius.xl,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    wheel: { height: WHEEL_HEIGHT },
    ageRow: {
      height: ITEM_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: spacing.xs,
    },
    ageRowPressed: { opacity: 0.72 },
    selectedAge: { minWidth: 64, textAlign: "right" },
    selection: {
      position: "absolute",
      zIndex: 2,
      left: spacing.md,
      right: spacing.md,
      top: WHEEL_PADDING,
      height: ITEM_HEIGHT,
      borderRadius: radius.md,
      backgroundColor: colors.successSoft,
      borderWidth: 1,
      borderColor: colors.actionPrimary,
    },
    topFade: {
      position: "absolute",
      zIndex: 3,
      left: 0,
      right: 0,
      top: 0,
      height: ITEM_HEIGHT,
      backgroundColor: colors.surfaceFade,
    },
    bottomFade: {
      position: "absolute",
      zIndex: 3,
      left: 0,
      right: 0,
      bottom: 0,
      height: ITEM_HEIGHT,
      backgroundColor: colors.surfaceFade,
    },
  });
}
