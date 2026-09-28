/**
 * Feedback composition and validation.
 *
 * Pore has no feedback endpoint, and inventing one would mean storing free
 * text people write about their skin. Instead the app composes a message and
 * hands it to the reader's own mail app, which means the app must never claim
 * the feedback was "sent" — it cannot know that. See `submitFeedback` in
 * `app/feedback.tsx` for how the outcome is reported.
 */
import type { MailDraft } from "./contact";

export const FEEDBACK_TOPICS = [
  { id: "bug", label: "Something is broken" },
  { id: "idea", label: "Idea or request" },
  { id: "question", label: "Question" },
  { id: "other", label: "Something else" },
] as const;

export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]["id"];

export const MIN_FEEDBACK_LENGTH = 20;
export const MAX_FEEDBACK_LENGTH = 2000;

export interface FeedbackDiagnostics {
  appVersion: string;
  platform: string;
  osVersion?: string;
  locale?: string;
}

export interface FeedbackInput {
  topic: FeedbackTopic;
  message: string;
  /** Attach app version and OS. Never photos, email, or skin notes. */
  includeDiagnostics: boolean;
  diagnostics?: FeedbackDiagnostics;
}

export type FeedbackValidation =
  | { valid: true; message: string }
  | { valid: false; reason: "empty" | "too-short" | "too-long"; error: string };

/** Validate the free-text body. Whitespace never counts toward the minimum. */
export function validateFeedback(raw: string): FeedbackValidation {
  const message = raw.trim();
  if (message.length === 0) {
    return {
      valid: false,
      reason: "empty",
      error: "Add a short description so we know what to look at.",
    };
  }
  if (message.length < MIN_FEEDBACK_LENGTH) {
    const remaining = MIN_FEEDBACK_LENGTH - message.length;
    return {
      valid: false,
      reason: "too-short",
      error: `A little more detail helps — ${remaining} more ${remaining === 1 ? "character" : "characters"}.`,
    };
  }
  if (message.length > MAX_FEEDBACK_LENGTH) {
    const over = message.length - MAX_FEEDBACK_LENGTH;
    return {
      valid: false,
      reason: "too-long",
      error: `That is ${over} ${over === 1 ? "character" : "characters"} over the limit. Please shorten it.`,
    };
  }
  return { valid: true, message };
}

export function feedbackTopicLabel(topic: FeedbackTopic): string {
  return FEEDBACK_TOPICS.find((entry) => entry.id === topic)?.label ?? "Feedback";
}

function diagnosticsBlock(diagnostics: FeedbackDiagnostics): string {
  const lines = [
    `App version: ${diagnostics.appVersion}`,
    `Platform: ${diagnostics.platform}${diagnostics.osVersion ? ` ${diagnostics.osVersion}` : ""}`,
  ];
  if (diagnostics.locale) lines.push(`Locale: ${diagnostics.locale}`);
  return ["---", "Sent from Pore. Technical details:", ...lines].join("\n");
}

/**
 * Compose the mail draft. Diagnostics are appended below a separator so the
 * reader can see and delete them before sending — the message is theirs.
 */
export function composeFeedback(input: FeedbackInput): MailDraft {
  const validation = validateFeedback(input.message);
  const message = validation.valid ? validation.message : input.message.trim();
  const parts = [message];
  if (input.includeDiagnostics && input.diagnostics) {
    parts.push(diagnosticsBlock(input.diagnostics));
  }
  return {
    subject: `Pore feedback: ${feedbackTopicLabel(input.topic)}`,
    body: parts.join("\n\n"),
  };
}
