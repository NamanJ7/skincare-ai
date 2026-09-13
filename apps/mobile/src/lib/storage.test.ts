import { beforeEach, describe, expect, it, vi } from "vitest";

const asyncStorage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  multiRemove: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: asyncStorage,
}));

import { clearAll, load, remove, save } from "./storage";

describe("storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    asyncStorage.getItem.mockResolvedValue(null);
    asyncStorage.setItem.mockResolvedValue(undefined);
    asyncStorage.removeItem.mockResolvedValue(undefined);
    asyncStorage.multiRemove.mockResolvedValue(undefined);
  });

  it("persists appearance in the versioned envelope", async () => {
    await expect(save("appearance", "dark")).resolves.toBe(true);

    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      "pore/appearance",
      JSON.stringify({ v: 1, data: "dark" }),
    );
  });

  it("loads a recognized appearance envelope", async () => {
    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ v: 1, data: "system" }),
    );

    await expect(load("appearance")).resolves.toBe("system");
    expect(asyncStorage.getItem).toHaveBeenCalledWith("pore/appearance");
  });

  it("fails closed for malformed and unknown-version data", async () => {
    asyncStorage.getItem.mockResolvedValue("not json");
    await expect(load("appearance")).resolves.toBeNull();

    asyncStorage.getItem.mockResolvedValue(
      JSON.stringify({ v: 2, data: "dark" }),
    );
    await expect(load("appearance")).resolves.toBeNull();
  });

  it("reports write and removal failures without throwing", async () => {
    asyncStorage.setItem.mockRejectedValueOnce(new Error("disk full"));
    asyncStorage.removeItem.mockRejectedValueOnce(new Error("unavailable"));

    await expect(save("appearance", "light")).resolves.toBe(false);
    await expect(remove("appearance")).resolves.toBe(false);
  });

  it("removes the appearance key directly", async () => {
    await expect(remove("appearance")).resolves.toBe(true);
    expect(asyncStorage.removeItem).toHaveBeenCalledWith("pore/appearance");
  });

  it("includes appearance in a complete local-data deletion", async () => {
    await expect(clearAll()).resolves.toBe(true);

    const removed = asyncStorage.multiRemove.mock.calls[0]?.[0] as string[];
    expect(removed).toContain("pore/appearance");
    expect(removed).toContain("pore/analytics-outbox");
  });

  it("reports a complete local-data deletion failure", async () => {
    asyncStorage.multiRemove.mockRejectedValueOnce(new Error("unavailable"));

    await expect(clearAll()).resolves.toBe(false);
  });
});
