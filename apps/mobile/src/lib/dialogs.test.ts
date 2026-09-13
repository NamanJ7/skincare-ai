/**
 * `Alert` in react-native-web is `class Alert { static alert() {} }` — every
 * confirmation and every failure notice silently did nothing on the web build,
 * which is the surface this app is reviewed on. These tests pin that both
 * platforms actually surface something, and that a cancelled confirm never
 * reports success.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const alertMock = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ OS: "ios" as string }));

vi.mock("react-native", () => ({
  Alert: { alert: alertMock },
  Platform: platform,
}));

import { confirm, notify } from "./dialogs";

/** Invoke the button at `index` of the last Alert.alert call. */
function pressAlertButton(index: number) {
  const buttons = alertMock.mock.calls.at(-1)?.[2] as
    | { text: string; style?: string; onPress?: () => void }[]
    | undefined;
  buttons?.[index]?.onPress?.();
  return buttons;
}

beforeEach(() => {
  platform.OS = "ios";
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("confirm on native", () => {
  it("resolves true when the affirmative button is pressed", async () => {
    const pending = confirm({ title: "Delete?", confirmLabel: "Delete" });
    pressAlertButton(1);
    await expect(pending).resolves.toBe(true);
  });

  it("resolves false when cancelled", async () => {
    const pending = confirm({ title: "Delete?", confirmLabel: "Delete" });
    pressAlertButton(0);
    await expect(pending).resolves.toBe(false);
  });

  it("keeps the destructive and cancel styling iOS expects", async () => {
    const pending = confirm({
      title: "Delete?",
      confirmLabel: "Delete",
      destructive: true,
    });
    const buttons = pressAlertButton(1);
    expect(buttons?.[0]).toMatchObject({ text: "Cancel", style: "cancel" });
    expect(buttons?.[1]).toMatchObject({ text: "Delete", style: "destructive" });
    await pending;
  });

  it("uses the default style when not destructive", async () => {
    const pending = confirm({ title: "Sure?", confirmLabel: "Yes" });
    const buttons = pressAlertButton(1);
    expect(buttons?.[1]).toMatchObject({ style: "default" });
    await pending;
  });

  it("honours a custom cancel label", async () => {
    const pending = confirm({
      title: "Sure?",
      confirmLabel: "Yes",
      cancelLabel: "Not now",
    });
    const buttons = pressAlertButton(0);
    expect(buttons?.[0]?.text).toBe("Not now");
    await pending;
  });
});

describe("confirm on web", () => {
  beforeEach(() => {
    platform.OS = "web";
  });

  it("uses a real browser dialog rather than the no-op Alert", async () => {
    const webConfirm = vi.fn(() => true);
    vi.stubGlobal("confirm", webConfirm);
    await expect(
      confirm({ title: "Delete?", message: "Gone forever.", confirmLabel: "Delete" }),
    ).resolves.toBe(true);
    expect(alertMock).not.toHaveBeenCalled();
    expect(webConfirm).toHaveBeenCalledOnce();
  });

  it("carries the button labels into the body, since web cannot render them", async () => {
    const webConfirm = vi.fn((_text: string) => true);
    vi.stubGlobal("confirm", webConfirm);
    await confirm({
      title: "Delete?",
      message: "Gone forever.",
      confirmLabel: "Delete account",
      cancelLabel: "Keep it",
    });
    const text = webConfirm.mock.calls[0]?.[0] ?? "";
    expect(text).toContain("Delete?");
    expect(text).toContain("Gone forever.");
    expect(text).toContain("Delete account");
    expect(text).toContain("Keep it");
  });

  it("resolves false when the browser dialog is dismissed", async () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    await expect(
      confirm({ title: "Delete?", confirmLabel: "Delete" }),
    ).resolves.toBe(false);
  });

  it("fails closed to 'not confirmed' where no dialog exists at all", async () => {
    vi.stubGlobal("confirm", undefined);
    // A destructive action must never proceed just because the environment
    // could not ask.
    await expect(
      confirm({ title: "Delete?", confirmLabel: "Delete" }),
    ).resolves.toBe(false);
  });
});

describe("notify", () => {
  it("uses Alert on native", () => {
    notify("Saved", "All good.");
    expect(alertMock).toHaveBeenCalledWith("Saved", "All good.");
  });

  it("uses a browser dialog on web", () => {
    platform.OS = "web";
    const webAlert = vi.fn();
    vi.stubGlobal("alert", webAlert);
    notify("Saved", "All good.");
    expect(webAlert).toHaveBeenCalledWith("Saved\n\nAll good.");
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("renders a title-only notice without a stray separator", () => {
    platform.OS = "web";
    const webAlert = vi.fn();
    vi.stubGlobal("alert", webAlert);
    notify("Saved");
    expect(webAlert).toHaveBeenCalledWith("Saved");
  });

  it("does not throw where no dialog exists", () => {
    platform.OS = "web";
    vi.stubGlobal("alert", undefined);
    expect(() => notify("Saved")).not.toThrow();
  });
});
