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

const supabaseModule = vi.hoisted(() => ({
  BACKEND_CONFIGURED: true,
  getSupabase: vi.fn(),
}));

vi.mock("./supabase", () => supabaseModule);

const cloudStore = vi.hoisted(() => ({
  pullAll: vi.fn(),
}));

vi.mock("./cloud-store", () => cloudStore);

import { pullMissingSnapshots } from "./hydrate";

function clientWithSession(userId: string | null) {
  return {
    auth: {
      getSession: async () => ({
        data: { session: userId ? { user: { id: userId } } : null },
      }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  asyncStorage.setItem.mockResolvedValue(undefined);
});

describe("pullMissingSnapshots", () => {
  it("returns nothing when no keys are missing", async () => {
    await expect(pullMissingSnapshots([])).resolves.toEqual({});
    expect(supabaseModule.getSupabase).not.toHaveBeenCalled();
  });

  it("returns nothing when the backend is unconfigured", async () => {
    supabaseModule.getSupabase.mockReturnValue(null);
    await expect(pullMissingSnapshots(["profile"])).resolves.toEqual({});
  });

  it("returns nothing without a signed-in session", async () => {
    supabaseModule.getSupabase.mockReturnValue(clientWithSession(null));
    await expect(pullMissingSnapshots(["profile"])).resolves.toEqual({});
    expect(cloudStore.pullAll).not.toHaveBeenCalled();
  });

  it("fills only the requested missing keys and caches them locally", async () => {
    supabaseModule.getSupabase.mockReturnValue(clientWithSession("user-1"));
    cloudStore.pullAll.mockResolvedValue({
      profile: { v: 1, data: { onboardingComplete: true } },
      log: { v: 1, data: { days: {} } },
    });

    const result = await pullMissingSnapshots(["profile"]);
    // log exists in the cloud but was not missing locally — local wins.
    expect(result).toEqual({ profile: { onboardingComplete: true } });
    expect(asyncStorage.setItem).toHaveBeenCalledWith(
      "pore/profile",
      JSON.stringify({ v: 1, data: { onboardingComplete: true } }),
    );
  });

  it("discards cloud envelopes with an unknown schema version", async () => {
    supabaseModule.getSupabase.mockReturnValue(clientWithSession("user-1"));
    cloudStore.pullAll.mockResolvedValue({
      profile: { v: 99, data: { onboardingComplete: true } },
    });

    await expect(pullMissingSnapshots(["profile"])).resolves.toEqual({});
    expect(asyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("swallows pull failures and falls back to local-only", async () => {
    supabaseModule.getSupabase.mockReturnValue(clientWithSession("user-1"));
    cloudStore.pullAll.mockRejectedValue(new Error("offline"));
    await expect(pullMissingSnapshots(["profile"])).resolves.toEqual({});
  });
});
