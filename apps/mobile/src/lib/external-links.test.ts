/**
 * `Linking.canOpenURL` answers "is something installed that handles this?", not
 * "is this safe to open" — on some Android configurations it returns true for
 * `javascript:`, and it returns true for any registered app scheme. Every caller
 * today passes a compile-time constant, so this suite is a guard on the helper
 * rather than a fix for a live bug: the moment a URL arrives from an API
 * response, the catalog, or a deep link, the allowlist is already in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

const alert = vi.hoisted(() => vi.fn());
const canOpenURL = vi.hoisted(() => vi.fn());
const openURL = vi.hoisted(() => vi.fn());
const openSettings = vi.hoisted(() => vi.fn());

vi.mock("react-native", () => ({
  Alert: { alert },
  Linking: { canOpenURL, openURL, openSettings },
  // openAppSettings reports failure through lib/dialogs, which branches on
  // Platform.OS. Without this the module graph throws before the assertion.
  Platform: { OS: "ios" },
}));

import { isAllowedExternalUrl, openAppSettings } from "./external-links";

afterEach(() => {
  vi.clearAllMocks();
});

describe("isAllowedExternalUrl", () => {
  it.each([
    "https://pore.skin/privacy",
    "https://pore.skin/terms?x=1",
    "mailto:support@pore.skin",
    "MAILTO:support@pore.skin",
    "HTTPS://pore.skin/",
  ])("allows %s", (url) => {
    expect(isAllowedExternalUrl(url)).toBe(true);
  });

  it.each([
    ["javascript:alert(1)", "script execution"],
    ["JaVaScRiPt:alert(1)", "cased to dodge a naive check"],
    ["  javascript:alert(1)", "leading whitespace"],
    ["data:text/html,<script>alert(1)</script>", "inline document"],
    ["file:///etc/passwd", "local file"],
    ["http://pore.skin/", "plaintext"],
    ["intent://scan#Intent;scheme=zxing;end", "Android intent"],
    ["tel:+15551234567", "unexpected scheme"],
    ["/privacy", "relative — no scheme to vouch for"],
    ["", "empty"],
  ])("rejects %s (%s)", (url) => {
    expect(isAllowedExternalUrl(url)).toBe(false);
  });
});

describe("openAppSettings", () => {
  it("reports success when the platform opens Settings", async () => {
    openSettings.mockResolvedValue(undefined);
    await expect(openAppSettings()).resolves.toBe(true);
    expect(alert).not.toHaveBeenCalled();
  });

  it("tells the user what to do instead of failing silently", async () => {
    openSettings.mockRejectedValue(new Error("no settings"));
    await expect(openAppSettings()).resolves.toBe(false);
    expect(alert).toHaveBeenCalledWith(
      "Could not open Settings",
      expect.stringContaining("Settings app"),
    );
  });
});
