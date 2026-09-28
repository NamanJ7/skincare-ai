/**
 * The contact path must never dead-end. `mailto:` fails on a simulator, on a
 * device with no mail account, and on the web build; the previous behaviour was
 * an alert reciting the address for the reader to memorise.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const canOpenURL = vi.hoisted(() => vi.fn());
const openURL = vi.hoisted(() => vi.fn());
const setStringAsync = vi.hoisted(() => vi.fn());
const notify = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ OS: "ios" as string }));

vi.mock("react-native", () => ({
  Alert: { alert: vi.fn() },
  Linking: { canOpenURL, openURL, openSettings: vi.fn() },
  Platform: platform,
}));

vi.mock("expo-clipboard", () => ({ setStringAsync }));
vi.mock("./dialogs", () => ({ notify, confirm: vi.fn() }));

import { contactSupport, mailtoUrl } from "./contact";
import { SUPPORT_EMAIL } from "./legal";

beforeEach(() => {
  platform.OS = "ios";
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("mailtoUrl", () => {
  it("builds a bare mailto when there is no draft", () => {
    expect(mailtoUrl("a@b.com")).toBe("mailto:a@b.com");
  });

  it("percent-encodes the subject and body", () => {
    const url = mailtoUrl("a@b.com", {
      subject: "Pore feedback: Something is broken",
      body: "Line one\nLine two & more",
    });
    expect(url).toContain("subject=Pore%20feedback%3A%20Something%20is%20broken");
    expect(url).toContain("body=Line%20one%0ALine%20two%20%26%20more");
    // An unencoded `&` would truncate the body at the first ampersand.
    expect(url.split("body=")[1]).not.toContain("&");
  });

  it("omits absent fields rather than sending empty parameters", () => {
    expect(mailtoUrl("a@b.com", { subject: "Hi" })).toBe("mailto:a@b.com?subject=Hi");
  });
});

describe("contactSupport on native", () => {
  it("opens the mail app and reports that it opened", async () => {
    canOpenURL.mockResolvedValue(true);
    openURL.mockResolvedValue(undefined);
    await expect(contactSupport()).resolves.toBe("opened");
    expect(openURL).toHaveBeenCalledWith(`mailto:${SUPPORT_EMAIL}`);
    expect(notify).not.toHaveBeenCalled();
  });

  it("carries the composed draft into the mail app", async () => {
    canOpenURL.mockResolvedValue(true);
    openURL.mockResolvedValue(undefined);
    await contactSupport({ subject: "Pore feedback: Question", body: "Hello" });
    expect(openURL).toHaveBeenCalledWith(
      `mailto:${SUPPORT_EMAIL}?subject=Pore%20feedback%3A%20Question&body=Hello`,
    );
  });

  it("copies the address when no mail app can handle the URL", async () => {
    canOpenURL.mockResolvedValue(false);
    setStringAsync.mockResolvedValue(true);
    await expect(contactSupport()).resolves.toBe("copied");
    expect(setStringAsync).toHaveBeenCalledWith(SUPPORT_EMAIL);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("No email app"),
      expect.stringContaining("clipboard"),
    );
  });

  it("copies the address when opening throws", async () => {
    canOpenURL.mockResolvedValue(true);
    openURL.mockRejectedValue(new Error("no handler"));
    setStringAsync.mockResolvedValue(true);
    await expect(contactSupport()).resolves.toBe("copied");
  });

  it("still tells the reader the address when the clipboard also fails", async () => {
    canOpenURL.mockResolvedValue(false);
    setStringAsync.mockRejectedValue(new Error("no clipboard"));
    await expect(contactSupport()).resolves.toBe("failed");
    expect(notify).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(SUPPORT_EMAIL),
    );
  });

  it("never claims success when nothing opened", async () => {
    canOpenURL.mockResolvedValue(false);
    setStringAsync.mockResolvedValue(true);
    await expect(contactSupport()).resolves.not.toBe("opened");
  });
});

describe("contactSupport on web", () => {
  beforeEach(() => {
    platform.OS = "web";
  });

  /**
   * react-native-web's `canOpenURL` is `Promise.resolve(true)` for every input
   * and `openURL` is `window.open`, which does nothing observable for a
   * `mailto:` with no handler and throws nothing either. The old code read that
   * as success, so the row looked dead while reporting "opened".
   */
  it("reports unverified rather than claiming the mail app opened", async () => {
    openURL.mockResolvedValue(undefined);
    setStringAsync.mockResolvedValue(true);
    await expect(contactSupport()).resolves.toBe("unverified");
  });

  it("never consults canOpenURL, which always lies on web", async () => {
    openURL.mockResolvedValue(undefined);
    setStringAsync.mockResolvedValue(true);
    await contactSupport();
    expect(canOpenURL).not.toHaveBeenCalled();
  });

  it("also copies the address so the row always has a real outcome", async () => {
    openURL.mockResolvedValue(undefined);
    setStringAsync.mockResolvedValue(true);
    await contactSupport();
    expect(setStringAsync).toHaveBeenCalledWith(SUPPORT_EMAIL);
    expect(notify).toHaveBeenCalledWith(
      expect.stringContaining("email app"),
      expect.stringContaining("clipboard"),
    );
  });

  it("falls back to the no-mail-app path when window.open throws", async () => {
    openURL.mockRejectedValue(new Error("blocked"));
    setStringAsync.mockResolvedValue(true);
    await expect(contactSupport()).resolves.toBe("copied");
  });

  it("still shows the address when both the handoff and clipboard fail", async () => {
    openURL.mockRejectedValue(new Error("blocked"));
    setStringAsync.mockRejectedValue(new Error("no clipboard"));
    await expect(contactSupport()).resolves.toBe("failed");
    expect(notify).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining(SUPPORT_EMAIL),
    );
  });

  it("always surfaces a dialog, so the row is never silently dead", async () => {
    openURL.mockResolvedValue(undefined);
    setStringAsync.mockResolvedValue(true);
    await contactSupport();
    expect(notify).toHaveBeenCalledOnce();
  });
});
