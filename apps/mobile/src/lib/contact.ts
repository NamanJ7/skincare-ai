/**
 * Reaching Pore support without a dead end.
 *
 * `mailto:` is not guaranteed to resolve: a device with no mail account
 * configured, a simulator, and the web build all fail it. The previous
 * behaviour was an alert that recited the address and left the reader to
 * memorise it. This offers the address on the clipboard instead, so the path
 * always ends somewhere useful.
 */
import * as Clipboard from "expo-clipboard";
import { Linking, Platform } from "react-native";

import { notify } from "./dialogs";
import { isAllowedExternalUrl } from "./external-links";
import { SUPPORT_EMAIL } from "./legal";

export type ContactOutcome =
  | "opened"
  /** Handed to the OS, but the platform gives no way to confirm it landed. */
  | "unverified"
  | "copied"
  | "failed";

export interface MailDraft {
  subject?: string;
  body?: string;
}

/** Build a `mailto:` URL with the subject and body percent-encoded. */
export function mailtoUrl(email: string, draft: MailDraft = {}): string {
  const params: string[] = [];
  if (draft.subject) params.push(`subject=${encodeURIComponent(draft.subject)}`);
  if (draft.body) params.push(`body=${encodeURIComponent(draft.body)}`);
  return params.length > 0
    ? `mailto:${email}?${params.join("&")}`
    : `mailto:${email}`;
}

async function copyAddress(): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(SUPPORT_EMAIL);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open the reader's mail app at Pore support, falling back to the clipboard.
 *
 * Resolves to what actually happened, so callers can tell the reader the truth
 * rather than assuming the mail app opened.
 */
export async function contactSupport(
  draft: MailDraft = {},
): Promise<ContactOutcome> {
  const url = mailtoUrl(SUPPORT_EMAIL, draft);

  if (!isAllowedExternalUrl(url)) return handleFailure();

  if (Platform.OS === "web") {
    // react-native-web's `canOpenURL` is `Promise.resolve(true)` for every
    // input, and `openURL` is `window.open`, which does nothing observable for
    // a `mailto:` with no registered handler and throws nothing either. The
    // outcome is genuinely unknowable here, so do both things that could help
    // and report `unverified` rather than claiming a success we cannot see.
    let handedOff = false;
    try {
      await Linking.openURL(url);
      handedOff = true;
    } catch {
      handedOff = false;
    }
    const copied = await copyAddress();
    if (handedOff) {
      notify(
        "Your email app should be opening",
        copied
          ? `If nothing opened, ${SUPPORT_EMAIL} is on your clipboard.`
          : `If nothing opened, write to ${SUPPORT_EMAIL}.`,
      );
      return "unverified";
    }
    return finishWithoutMailApp(copied);
  }

  try {
    if (!(await Linking.canOpenURL(url))) throw new Error("no mail app");
    await Linking.openURL(url);
    return "opened";
  } catch {
    return handleFailure();
  }
}

async function handleFailure(): Promise<ContactOutcome> {
  return finishWithoutMailApp(await copyAddress());
}

function finishWithoutMailApp(copied: boolean): ContactOutcome {
  notify(
    "No email app is set up on this device",
    copied
      ? `Pore copied ${SUPPORT_EMAIL} to your clipboard — paste it wherever you read email.`
      : `You can reach Pore at ${SUPPORT_EMAIL}.`,
  );
  return copied ? "copied" : "failed";
}
