/**
 * Account session state. When the backend is not configured (placeholder
 * build) the status is "disabled" and every auth action is unavailable —
 * the app then behaves exactly like the local-only beta. This provider never
 * fabricates a session; the only signed-in state is a real Supabase session.
 */
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import * as AppleAuthentication from "expo-apple-authentication";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";

import { BACKEND_CONFIGURED, getSupabase } from "@/lib/backend/supabase";
import {
  installCloudMirror,
  uninstallCloudMirror,
} from "@/lib/backend/mirror";

export type SessionStatus = "disabled" | "signedOut" | "signedIn";

export type AuthOutcome =
  | { ok: true }
  | { ok: false; message: string; canceled?: boolean };

export interface SessionValue {
  status: SessionStatus;
  userId?: string;
  email?: string;
  /** Whether Sign in with Apple is offered on this device. */
  appleAvailable: boolean;
  signIn(email: string, password: string): Promise<AuthOutcome>;
  /**
   * Send a password-reset email. Without this a user who forgets their password
   * loses every scan and routine they backed up, permanently.
   */
  resetPassword(email: string): Promise<AuthOutcome>;
  signUp(email: string, password: string): Promise<AuthOutcome>;
  signInWithApple(): Promise<AuthOutcome>;
  signOut(): Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

/** Friendly copy for the auth errors users actually hit; never raw internals. */
function friendlyAuthMessage(raw: string | undefined): string {
  const text = (raw ?? "").toLowerCase();
  if (text.includes("invalid login credentials"))
    return "That email and password don't match an account.";
  if (text.includes("already registered") || text.includes("already exists"))
    return "An account with this email already exists. Try signing in instead.";
  if (text.includes("password") && text.includes("at least"))
    return "Passwords need at least 8 characters.";
  if (text.includes("valid email") || text.includes("invalid format"))
    return "That doesn't look like a valid email address.";
  if (text.includes("rate limit") || text.includes("too many"))
    return "Too many attempts. Wait a moment and try again.";
  if (text.includes("network") || text.includes("fetch"))
    return "Couldn't reach the account service. Check your connection.";
  return "Something went wrong signing in. Please try again.";
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    let active = true;
    client.auth
      .getSession()
      .then(async ({ data }) => {
        if (!active) return;
        if (data.session) {
          setSession(data.session);
          return;
        }
        // No session yet. Establish an anonymous one so the device carries a
        // real auth.uid() through onboarding: /api/plan meters paid analysis
        // per user, and without an identity every pre-account scan would fall
        // into one shared bucket. Signing up later upgrades this same user in
        // place (see signUp below), so nothing is stranded.
        const { data: anon } = await client.auth.signInAnonymously();
        if (active) setSession(anon.session ?? null);
      })
      // A keychain or network failure here is a signed-out start, not a crash:
      // this runs during hydration, so an unhandled rejection surfaces as a
      // red screen before the app has drawn anything.
      .catch(() => {});
    const { data: subscription } = client.auth.onAuthStateChange(
      (_event, next) => {
        if (active) setSession(next);
      },
    );
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!BACKEND_CONFIGURED || Platform.OS !== "ios") return;
    let active = true;
    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (active) setAppleAvailable(available);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // An anonymous session is an identity for metering, not an account. Every
  // account-facing surface below keys off `accountUserId`, which stays
  // undefined until the user actually signs up — so the UI, the cloud mirror
  // and `status` behave exactly as they did before anonymous sign-in existed.
  const isAnonymous = session?.user?.is_anonymous === true;
  const accountUserId =
    session?.user && !isAnonymous ? session.user.id : undefined;

  // The cloud mirror follows the session: local writes sync only while a real
  // user is signed in, and stop the moment they sign out. Anonymous devices
  // deliberately do not mirror — abandoned onboarding should not accumulate
  // rows of skin data server-side.
  useEffect(() => {
    const client = getSupabase();
    if (!client || !accountUserId) return;
    installCloudMirror(client, accountUserId);
    return () => uninstallCloudMirror();
  }, [accountUserId]);

  const value = useMemo<SessionValue>(() => {
    const client = getSupabase();

    async function run(
      action: (client: SupabaseClient) => Promise<{ error: { message: string } | null }>,
    ): Promise<AuthOutcome> {
      if (!client)
        return { ok: false, message: "Accounts are not enabled in this build." };
      try {
        const { error } = await action(client);
        if (error) return { ok: false, message: friendlyAuthMessage(error.message) };
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          message: friendlyAuthMessage(
            err instanceof Error ? err.message : undefined,
          ),
        };
      }
    }

    return {
      status: !BACKEND_CONFIGURED
        ? "disabled"
        : accountUserId
          ? "signedIn"
          : "signedOut",
      userId: accountUserId,
      email: accountUserId ? (session?.user?.email ?? undefined) : undefined,
      appleAvailable,
      signIn: (email, password) =>
        run((c) => c.auth.signInWithPassword({ email: email.trim(), password })),
      // Deep link back into the app; `scheme: "pore"` is declared in app.json.
      resetPassword: (email) =>
        run((c) =>
          c.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: "pore://reset-password",
          }),
        ),
      // Converting the anonymous user in place keeps the same auth.uid(), so
      // the scans and quota accrued during onboarding carry over rather than
      // being stranded under a discarded identity.
      signUp: (email, password) =>
        isAnonymous
          ? run((c) => c.auth.updateUser({ email: email.trim(), password }))
          : run((c) => c.auth.signUp({ email: email.trim(), password })),
      signInWithApple: async () => {
        if (!client)
          return { ok: false, message: "Accounts are not enabled in this build." };
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          });
          if (!credential.identityToken)
            return { ok: false, message: friendlyAuthMessage(undefined) };
          return run((c) =>
            c.auth.signInWithIdToken({
              provider: "apple",
              token: credential.identityToken!,
            }),
          );
        } catch (err) {
          const code = (err as { code?: string } | null)?.code;
          if (code === "ERR_REQUEST_CANCELED")
            return { ok: false, canceled: true, message: "" };
          return { ok: false, message: friendlyAuthMessage(undefined) };
        }
      },
      signOut: async () => {
        if (!client) return;
        try {
          await client.auth.signOut();
          // Drop straight back to an anonymous identity. Without this the app
          // would be left with no token at all, and the signed-out experience
          // (which still offers a scan) would get a 401 from /api/plan.
          await client.auth.signInAnonymously();
        } catch {
          // Local session is cleared regardless via onAuthStateChange.
        }
      },
    };
  }, [session, appleAvailable, accountUserId, isAnonymous]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used within SessionProvider");
  return value;
}
