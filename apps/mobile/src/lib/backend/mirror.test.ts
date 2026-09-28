import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  multiRemove: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));

const cloudStore = vi.hoisted(() => ({
  pushSnapshot: vi.fn(),
  removeSnapshot: vi.fn(),
}));

vi.mock("./cloud-store", () => cloudStore);

import type { SupabaseClient } from "@supabase/supabase-js";

import { remove, save } from "../storage";
import { installCloudMirror, uninstallCloudMirror } from "./mirror";

const client = {} as SupabaseClient;

describe("cloud mirror", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    asyncStorage.setItem.mockResolvedValue(undefined);
    asyncStorage.removeItem.mockResolvedValue(undefined);
    cloudStore.pushSnapshot.mockResolvedValue(true);
    cloudStore.removeSnapshot.mockResolvedValue(true);
  });

  afterEach(() => {
    uninstallCloudMirror();
    vi.useRealTimers();
  });

  it("pushes a saved envelope after the debounce window", async () => {
    installCloudMirror(client, "user-1");
    await save("appearance", "dark");
    expect(cloudStore.pushSnapshot).not.toHaveBeenCalled();

    vi.advanceTimersByTime(500);
    expect(cloudStore.pushSnapshot).toHaveBeenCalledWith(
      client,
      "user-1",
      "appearance",
      { v: 1, data: "dark" },
    );
  });

  it("coalesces rapid writes to the same key into one push of the latest", async () => {
    installCloudMirror(client, "user-1");
    await save("appearance", "light");
    vi.advanceTimersByTime(300);
    await save("appearance", "dark");
    vi.advanceTimersByTime(500);

    expect(cloudStore.pushSnapshot).toHaveBeenCalledTimes(1);
    expect(cloudStore.pushSnapshot).toHaveBeenCalledWith(
      client,
      "user-1",
      "appearance",
      { v: 1, data: "dark" },
    );
  });

  it("debounces keys independently", async () => {
    installCloudMirror(client, "user-1");
    await save("appearance", "dark");
    await save("log", { days: {} });
    vi.advanceTimersByTime(500);

    expect(cloudStore.pushSnapshot).toHaveBeenCalledTimes(2);
  });

  it("mirrors a remove immediately and cancels any pending push", async () => {
    installCloudMirror(client, "user-1");
    await save("appearance", "dark");
    await remove("appearance");
    vi.advanceTimersByTime(500);

    expect(cloudStore.pushSnapshot).not.toHaveBeenCalled();
    expect(cloudStore.removeSnapshot).toHaveBeenCalledWith(
      client,
      "user-1",
      "appearance",
    );
  });

  it("does nothing after uninstall", async () => {
    installCloudMirror(client, "user-1");
    uninstallCloudMirror();
    await save("appearance", "dark");
    vi.advanceTimersByTime(500);

    expect(cloudStore.pushSnapshot).not.toHaveBeenCalled();
  });

  it("cancels queued pushes at uninstall time", async () => {
    installCloudMirror(client, "user-1");
    await save("appearance", "dark");
    uninstallCloudMirror();
    vi.advanceTimersByTime(500);

    expect(cloudStore.pushSnapshot).not.toHaveBeenCalled();
  });

  it("never affects the local write result", async () => {
    installCloudMirror(client, "user-1");
    cloudStore.pushSnapshot.mockRejectedValue(new Error("offline"));
    await expect(save("appearance", "dark")).resolves.toBe(true);
    vi.advanceTimersByTime(500);
  });
});
