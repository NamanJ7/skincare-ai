/**
 * Send feedback.
 *
 * The app has no feedback endpoint, so this composes the message and hands it
 * to the reader's mail app. That constrains the copy: the success state says
 * the draft is ready to send, never that it was sent, because the app cannot
 * observe whether the reader pressed send.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import Constants from "expo-constants";
import { router } from "expo-router";
import { useRef, useState } from "react";
import { Platform, Pressable, View } from "react-native";

import { track } from "@/lib/analytics";
import { contactSupport } from "@/lib/contact";
import {
  FEEDBACK_TOPICS,
  MAX_FEEDBACK_LENGTH,
  composeFeedback,
  validateFeedback,
  type FeedbackDiagnostics,
  type FeedbackTopic,
} from "@/lib/feedback";
import { SUPPORT_EMAIL } from "@/lib/legal";
import { closeTo } from "@/lib/nav";
import {
  AppText,
  Callout,
  Card,
  Chip,
  Divider,
  ListRow,
  PrimaryButton,
  Screen,
  SectionHeader,
  TextField,
  spacing,
  useThemeColors,
} from "@/theme";

function deviceDiagnostics(): FeedbackDiagnostics {
  let locale: string | undefined;
  try {
    locale = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    // Some runtimes ship a trimmed Intl. The rest of the block is still useful.
  }
  return {
    appVersion:
      Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? "unknown",
    platform: Platform.OS,
    osVersion:
      typeof Platform.Version === "string" || typeof Platform.Version === "number"
        ? String(Platform.Version)
        : undefined,
    locale,
  };
}

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "ready" }
  | { kind: "unverified" }
  | { kind: "copied" }
  | { kind: "failed" };

export default function FeedbackScreen() {
  const colors = useThemeColors();
  const [topic, setTopic] = useState<FeedbackTopic>("bug");
  const [message, setMessage] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Mirrors the deleteInFlight guard in Profile: state alone loses the race
  // when two taps land inside one render.
  const inFlight = useRef(false);

  const close = () => closeTo();

  const remaining = MAX_FEEDBACK_LENGTH - message.trim().length;
  const sending = status.kind === "sending";

  const submit = async () => {
    if (inFlight.current) return;

    const validation = validateFeedback(message);
    if (!validation.valid) {
      setError(validation.error);
      setStatus({ kind: "idle" });
      return;
    }

    inFlight.current = true;
    setError(null);
    setStatus({ kind: "sending" });
    track("feedback_submitted", { topic, diagnostics: includeDiagnostics });

    const outcome = await contactSupport(
      composeFeedback({
        topic,
        message: validation.message,
        includeDiagnostics,
        diagnostics: includeDiagnostics ? deviceDiagnostics() : undefined,
      }),
    );

    inFlight.current = false;
    setStatus({ kind: outcome === "opened" ? "ready" : outcome });
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: spacing.sm,
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText variant="titleSans" accessibilityRole="header">
            Send feedback
          </AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Tell us what is not working, or what would make Pore better.
          </AppText>
        </View>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close feedback"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <SectionHeader title="What is this about?" />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
        {FEEDBACK_TOPICS.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.label}
            selected={topic === entry.id}
            onPress={() => setTopic(entry.id)}
          />
        ))}
      </View>

      <SectionHeader title="Your message" />
      <TextField
        label="Message"
        value={message}
        onChangeText={(next) => {
          setMessage(next);
          if (error) setError(null);
          if (status.kind !== "idle") setStatus({ kind: "idle" });
        }}
        placeholder="What happened, and what did you expect instead?"
        multiline
        numberOfLines={6}
        maxLength={MAX_FEEDBACK_LENGTH + 200}
        editable={!sending}
        textAlignVertical="top"
        style={{ minHeight: 132 }}
        accessibilityHint="Describe the problem or idea in your own words"
      />
      <AppText
        variant="caption"
        color={remaining < 0 ? colors.error : colors.textSecondary}
      >
        {remaining < 0
          ? `${Math.abs(remaining)} characters over the limit`
          : `${remaining} characters left`}
      </AppText>

      {error ? (
        <AppText
          variant="caption"
          color={colors.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </AppText>
      ) : null}

      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon={includeDiagnostics ? "checkbox-outline" : "square-outline"}
          label="Include app version and device"
          detail="No photos, email address, or skin notes"
          trailing="none"
          onPress={() => setIncludeDiagnostics((value) => !value)}
          disabled={sending}
        />
      </Card>

      <PrimaryButton
        label={sending ? "Opening your email app…" : "Send feedback"}
        onPress={() => void submit()}
        disabled={sending}
        loading={sending}
      />

      {status.kind === "ready" ? (
        <Callout tone="success" title="Your email app is open">
          <AppText variant="caption" color={colors.textPrimary}>
            The message is written and addressed to {SUPPORT_EMAIL}. Press send
            in your email app to deliver it — Pore cannot send it for you.
          </AppText>
        </Callout>
      ) : null}

      {status.kind === "unverified" ? (
        <Callout tone="info" title="Handed to your email app">
          <AppText variant="caption" color={colors.textPrimary}>
            Pore passed your message to your email app, but cannot confirm it
            opened. If nothing appeared, write to {SUPPORT_EMAIL} — the address
            is on your clipboard — and paste your message in.
          </AppText>
        </Callout>
      ) : null}

      {status.kind === "copied" ? (
        <Callout tone="caution" title="No email app is set up">
          <AppText variant="caption" color={colors.textPrimary}>
            Your message was not sent. Pore copied {SUPPORT_EMAIL} to your
            clipboard — paste it wherever you read email, and paste your message
            in as well.
          </AppText>
        </Callout>
      ) : null}

      {status.kind === "failed" ? (
        <Callout tone="caution" title="Your message was not sent">
          <AppText variant="caption" color={colors.textPrimary}>
            Pore could not open an email app on this device. Write to{" "}
            {SUPPORT_EMAIL} from wherever you read email, and include your
            message above.
          </AppText>
        </Callout>
      ) : null}

      <SectionHeader title="Other ways to reach us" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="mail-outline"
          label="Email Pore directly"
          detail={SUPPORT_EMAIL}
          onPress={() => void contactSupport()}
        />
        <Divider />
        <ListRow
          icon="help-circle-outline"
          label="Help & education"
          detail="Answers to common questions about scans and routines"
          onPress={() => router.push("/help")}
        />
      </Card>
    </Screen>
  );
}
