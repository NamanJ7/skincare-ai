import { useFonts } from "expo-font";
import {
  Redirect,
  Stack,
  useSegments,
  type ErrorBoundaryProps,
  type Href,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useRef, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { RetentionEffects } from "@/components/RetentionEffects";
import { AnalyticsLifecycle } from "@/components/AnalyticsLifecycle";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import { pullMissingSnapshots } from "@/lib/backend/hydrate";
import { BACKEND_CONFIGURED } from "@/lib/backend/supabase";
import { profileAuthorizationHref } from "@/lib/nav";
import { installScanPhotoDisposer } from "@/lib/photos";
import {
  incompleteOnboardingRedirect,
  isAlwaysPublicRoute,
} from "@/lib/route-access";
import { load, type StoreKey } from "@/lib/storage";
import type { CheckInLog } from "@/lib/check-in";
import type { RoutineLog } from "@/lib/log";
import type { ReminderPrefs } from "@/lib/reminders";
import type { ScanHistory } from "@/lib/scan-history";
import { CheckInsProvider } from "@/state/check-ins";
import { EntitlementProvider, type Entitlement } from "@/state/entitlement";
import {
  OnboardingProvider,
  useOnboarding,
  type OnboardingData,
} from "@/state/onboarding";
import { RemindersProvider } from "@/state/reminders";
import { RoutineLogProvider } from "@/state/routine-log";
import { ScanHistoryProvider } from "@/state/scan-history";
import { SessionProvider } from "@/state/session";
import {
  initialAppearancePreference,
  ThemeProvider,
  useTheme,
  type AppearancePreference,
} from "@/theme";
import { fontModules } from "@/theme/fonts";

// Scan captures write full-resolution face JPEGs into the cache dir. Registering
// the disposer at module scope means every scan-flow exit reclaims them, rather
// than leaving them for iOS to evict whenever it feels storage pressure.
installScanPhotoDisposer();

// Keep the native splash up until the brand fonts are ready, so we never flash
// system fonts before Fraunces/Inter load.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

export function ErrorBoundary(props: ErrorBoundaryProps) {
  return (
    <ThemeProvider>
      <AppErrorBoundary {...props} />
    </ThemeProvider>
  );
}

interface Persisted {
  profile: OnboardingData | null;
  log: RoutineLog | null;
  entitlement: Entitlement | null;
  checkins: CheckInLog | null;
  scans: ScanHistory | null;
  reminders: ReminderPrefs | null;
  appearance: AppearancePreference;
}

const AGE_POLICY_SCREENS = new Set([
  "age",
  "age-restricted",
  "parent-consent",
  "teen-consent",
]);

/**
 * Enforce the age policy across deep links and restored sessions, not only the
 * happy-path onboarding buttons.
 */
function AppNavigator() {
  const { colors } = useTheme();
  const { data } = useOnboarding();
  const segments = useSegments();
  const pathSegments = segments as readonly string[];
  const onAgePolicyScreen =
    pathSegments[0] === "onboarding" &&
    typeof pathSegments[1] === "string" &&
    AGE_POLICY_SCREENS.has(pathSegments[1]);
  const beforeAgeEntry =
    pathSegments.length === 0 ||
    pathSegments[0] === "index" ||
    pathSegments[0] === "(auth)";
  const required = profileAuthorizationHref(data);

  if (
    required &&
    !onAgePolicyScreen &&
    !isAlwaysPublicRoute(pathSegments) &&
    !(required === "/onboarding/age" && beforeAgeEntry)
  ) {
    return <Redirect href={required as Href} />;
  }

  const onboardingRedirect = incompleteOnboardingRedirect(data, pathSegments);
  if (onboardingRedirect) {
    return <Redirect href={onboardingRedirect as Href} />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="reminders" options={{ presentation: "modal" }} />
      <Stack.Screen name="add-product" options={{ presentation: "modal" }} />
      <Stack.Screen name="edit-profile" options={{ presentation: "modal" }} />
      <Stack.Screen name="paywall" options={{ presentation: "modal" }} />
      <Stack.Screen name="feedback" options={{ presentation: "modal" }} />
      <Stack.Screen name="legal" options={{ presentation: "modal" }} />
      <Stack.Screen name="report" />
      <Stack.Screen name="results" />
      <Stack.Screen name="routine-session" />
    </Stack>
  );
}

/** Hydrate persisted state before first render so redirects never flicker. */
function usePersisted(): Persisted | null {
  const [persisted, setPersisted] = useState<Persisted | null>(null);
  useEffect(() => {
    let active = true;
    async function hydrate() {
      // Nothing in here may leave `persisted` null: RootLayout renders null
      // until it resolves, which holds the native splash up indefinitely. Every
      // failure mode has to degrade to "start empty", never to "never start".
      const local: Record<StoreKey, unknown> = {
        profile: null,
        log: null,
        entitlement: null,
        checkins: null,
        scans: null,
        reminders: null,
        appearance: null,
      };
      try {
        const [
          profile,
          log,
          entitlement,
          checkins,
          scans,
          reminders,
          appearance,
        ] = await Promise.all([
          load<OnboardingData>("profile"),
          load<RoutineLog>("log"),
          load<Entitlement>("entitlement"),
          load<CheckInLog>("checkins"),
          load<ScanHistory>("scans"),
          load<ReminderPrefs>("reminders"),
          load<AppearancePreference>("appearance"),
        ]);
        Object.assign(local, {
          profile,
          log,
          entitlement,
          checkins,
          scans,
          reminders,
          appearance,
        });

        // New device / fresh install with a restored session: fill locally-empty
        // keys from the account backup. Local data always wins when present.
        if (BACKEND_CONFIGURED) {
          const missing = (Object.keys(local) as StoreKey[]).filter(
            (key) => local[key] === null,
          );
          const cloud = await pullMissingSnapshots(missing);
          for (const key of missing) {
            if (cloud[key] != null) local[key] = cloud[key];
          }
        }
      } catch {
        // Fall through with whatever was read before the failure.
      }

      if (active) {
        setPersisted({
          profile: local.profile as OnboardingData | null,
          log: local.log as RoutineLog | null,
          entitlement: local.entitlement as Entitlement | null,
          checkins: local.checkins as CheckInLog | null,
          scans: local.scans as ScanHistory | null,
          reminders: local.reminders as ReminderPrefs | null,
          appearance: initialAppearancePreference(
            local.appearance as AppearancePreference | null,
          ),
        });
      }
    }
    void hydrate();
    return () => {
      active = false;
    };
  }, []);
  return persisted;
}

function ThemedApplication({ persisted }: { persisted: Persisted }) {
  const { colors, isDark } = useTheme();
  const splashHidden = useRef(false);

  // Keep the native root and system chrome aligned with the resolved theme.
  // The first call completes before the splash is dismissed, preventing a
  // light root-view flash when a saved or system dark theme is restored.
  useEffect(() => {
    let active = true;
    async function applyNativeTheme() {
      try {
        await SystemUI.setBackgroundColorAsync(colors.background);
      } catch {
        // Some web/test environments do not expose a native root view.
      }
      if (active && !splashHidden.current) {
        splashHidden.current = true;
        await SplashScreen.hideAsync();
      }
    }
    void applyNativeTheme();
    return () => {
      active = false;
    };
  }, [colors.background]);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <OnboardingProvider initial={persisted.profile ?? undefined}>
          <RoutineLogProvider initial={persisted.log ?? undefined}>
            <EntitlementProvider initial={persisted.entitlement ?? undefined}>
              <CheckInsProvider initial={persisted.checkins ?? undefined}>
                <RemindersProvider initial={persisted.reminders ?? undefined}>
                  <ScanHistoryProvider initial={persisted.scans ?? undefined}>
                    <AnalyticsLifecycle />
                    <StatusBar style={isDark ? "light" : "dark"} />
                    <RetentionEffects />
                    <AppNavigator />
                  </ScanHistoryProvider>
                </RemindersProvider>
              </CheckInsProvider>
            </EntitlementProvider>
          </RoutineLogProvider>
        </OnboardingProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontModules);
  const persisted = usePersisted();
  const ready = (fontsLoaded || !!fontError) && persisted !== null;

  if (!ready) {
    return null;
  }

  return (
    <ThemeProvider initialPreference={persisted.appearance}>
      <ThemedApplication persisted={persisted} />
    </ThemeProvider>
  );
}
