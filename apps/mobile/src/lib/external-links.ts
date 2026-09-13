import { Linking } from "react-native";

import { notify } from "./dialogs";

/**
 * Schemes a Pore link is ever allowed to use.
 *
 * `Linking.canOpenURL` is a capability check, not a safety check — it answers
 * "is something installed that handles this?", and on some Android
 * configurations that includes `javascript:`. Every caller today passes a
 * compile-time constant, so this changes no current behaviour; it exists so the
 * first time a URL arrives from the catalog, an API response, or a deep link,
 * the guard is already here rather than something to remember to add.
 */
const ALLOWED_PROTOCOLS = ["https:", "mailto:"];

export function isAllowedExternalUrl(url: string): boolean {
  // RN has a URL polyfill, but it is lenient about relative input, so require
  // an explicit scheme before trusting the parse.
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url.trim());
  if (!scheme) return false;
  return ALLOWED_PROTOCOLS.includes(scheme[1]!.toLowerCase() + ":");
}

export async function openAppSettings(): Promise<boolean> {
  try {
    await Linking.openSettings();
    return true;
  } catch {
    notify(
      "Could not open Settings",
      "Open your device Settings app and choose Pore to update permissions.",
    );
    return false;
  }
}
