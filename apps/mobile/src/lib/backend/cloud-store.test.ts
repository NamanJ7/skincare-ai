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

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  photoObjectKey,
  pullAll,
  pushSnapshot,
  removeSnapshot,
} from "./cloud-store";

interface RecordedCall {
  table: string;
  op: string;
  args: unknown[];
}

interface FakeData {
  /** maybeSingle() responses per table. */
  single?: Record<string, unknown>;
  /** order() list responses per table. */
  rows?: Record<string, unknown[]>;
}

function fakeClient(data: FakeData = {}) {
  const calls: RecordedCall[] = [];
  const client = {
    from(table: string) {
      return {
        upsert(values: unknown, opts?: unknown) {
          calls.push({ table, op: "upsert", args: [values, opts] });
          return Promise.resolve({ error: null });
        },
        delete() {
          const chain = {
            eq(col: string, val: unknown) {
              calls.push({ table, op: "delete.eq", args: [col, val] });
              return chain;
            },
            not(col: string, operator: string, val: unknown) {
              calls.push({ table, op: "delete.not", args: [col, operator, val] });
              return chain;
            },
            then(resolve: (v: { error: null }) => void) {
              resolve({ error: null });
            },
          };
          return chain;
        },
        select(_cols: string) {
          return {
            eq(_col: string, _val: unknown) {
              return {
                maybeSingle: async () => ({
                  data: data.single?.[table] ?? null,
                }),
                order: async (_c: string, _o?: unknown) => ({
                  data: data.rows?.[table] ?? [],
                }),
              };
            },
          };
        },
      };
    },
    storage: {
      from(_bucket: string) {
        return {
          upload(key: string, bytes: unknown, opts?: unknown) {
            calls.push({ table: "storage", op: "upload", args: [key, bytes, opts] });
            return Promise.resolve({ error: null });
          },
        };
      },
    },
  };
  return { client: client as unknown as SupabaseClient, calls };
}

const USER = "user-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pushSnapshot", () => {
  it("stores the profile envelope in the profiles.onboarding column", async () => {
    const { client, calls } = fakeClient();
    const envelope = { v: 1, data: { onboardingComplete: true } };
    await expect(pushSnapshot(client, USER, "profile", envelope)).resolves.toBe(true);

    expect(calls).toEqual([
      {
        table: "profiles",
        op: "upsert",
        args: [
          { user_id: USER, onboarding: envelope },
          { onConflict: "user_id" },
        ],
      },
    ]);
  });

  it("maps appearance, log, and reminders to their snapshot columns", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "appearance", { v: 1, data: "dark" });
    await pushSnapshot(client, USER, "log", { v: 1, data: { days: {} } });
    await pushSnapshot(client, USER, "reminders", { v: 1, data: { optIn: true } });

    expect(calls.map((c) => c.table)).toEqual(["profiles", "routine_logs", "reminders"]);
    expect(calls[0].args[0]).toHaveProperty("appearance");
    expect(calls[1].args[0]).toHaveProperty("data");
    expect(calls[2].args[0]).toHaveProperty("data");
  });

  it("never writes billing-managed entitlement columns", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "entitlement", {
      v: 1,
      data: {
        // Even a corrupted/hostile local envelope claiming Plus must not
        // reach the plan columns.
        unlocked: true,
        tier: "plus",
        term: "monthly",
        unlockedAt: "2026-01-01",
        compatibilityUsage: { month: "2026-07", productIds: ["a"] },
        plusInterest: { recordedAt: "2026-07-01" },
      },
    });

    const row = calls[0].args[0] as Record<string, unknown>;
    expect(Object.keys(row).sort()).toEqual([
      "compatibility_usage",
      "plus_interest",
      "user_id",
    ]);
  });

  it("fans scan records out into rows and prunes deleted ones", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "scans", {
      v: 1,
      data: {
        scans: [
          {
            createdAt: "2026-07-01T10:00:00Z",
            scanId: "scan-a",
            photoNames: ["1-front.jpg", "1-right.jpg"],
          },
          { createdAt: "2026-07-08T10:00:00Z", photoNames: [] },
        ],
      },
    });

    const upsert = calls.find((c) => c.op === "upsert");
    const rows = upsert?.args[0] as Array<Record<string, unknown>>;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      user_id: USER,
      id: "2026-07-01T10:00:00Z",
      photo_keys: [
        `${USER}/scan-a/1-front.jpg`,
        `${USER}/scan-a/1-right.jpg`,
      ],
    });
    // Records without a scanId key photos under their createdAt.
    expect(rows[1].photo_keys).toEqual([]);

    const prune = calls.find((c) => c.op === "delete.not");
    expect(prune?.args[2]).toBe(
      '("2026-07-01T10:00:00Z","2026-07-08T10:00:00Z")',
    );
  });

  it("clears all scan rows when the local history is empty", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "scans", { v: 1, data: { scans: [] } });

    expect(calls.some((c) => c.op === "upsert")).toBe(false);
    expect(calls.some((c) => c.op === "delete.eq")).toBe(true);
    expect(calls.some((c) => c.op === "delete.not")).toBe(false);
  });

  it("fans check-ins out one row per day with photo keys", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "checkins", {
      v: 1,
      data: {
        entries: [
          {
            date: "2026-07-15",
            createdAt: "2026-07-15T09:00:00Z",
            photoName: "checkin-1.jpg",
          },
        ],
      },
    });

    const upsert = calls.find((c) => c.op === "upsert");
    const rows = upsert?.args[0] as Array<Record<string, unknown>>;
    expect(rows[0]).toMatchObject({
      id: "2026-07-15",
      photo_keys: [`${USER}/2026-07-15/checkin-1.jpg`],
    });
  });
});

describe("removeSnapshot", () => {
  it("deletes record rows and nulls snapshot columns", async () => {
    const { client, calls } = fakeClient();
    await removeSnapshot(client, USER, "scans");
    await removeSnapshot(client, USER, "profile");

    expect(calls[0]).toMatchObject({ table: "scans", op: "delete.eq" });
    expect(calls[1]).toMatchObject({ table: "profiles", op: "upsert" });
    expect((calls[1].args[0] as Record<string, unknown>).onboarding).toBeNull();
  });
});

describe("pullAll", () => {
  it("reassembles envelopes from every table", async () => {
    const { client } = fakeClient({
      single: {
        profiles: {
          onboarding: { v: 1, data: { onboardingComplete: true } },
          appearance: { v: 1, data: "dark" },
        },
        routine_logs: { data: { v: 1, data: { days: {} } } },
        reminders: { data: { v: 1, data: { optIn: false } } },
        entitlements: {
          plan: "plus",
          term: "monthly",
          unlocked_at: "2026-06-01T00:00:00Z",
          compatibility_usage: { month: "2026-07", productIds: [] },
          plus_interest: null,
        },
      },
      rows: {
        scans: [{ payload: { createdAt: "2026-07-01T10:00:00Z" } }],
        checkins: [{ payload: { date: "2026-07-15" } }],
      },
    });

    const result = await pullAll(client, USER);
    expect(result.profile).toEqual({ v: 1, data: { onboardingComplete: true } });
    expect(result.appearance).toEqual({ v: 1, data: "dark" });
    expect(result.log).toEqual({ v: 1, data: { days: {} } });
    expect(result.reminders).toEqual({ v: 1, data: { optIn: false } });
    expect(result.entitlement).toEqual({
      v: 1,
      data: {
        unlocked: true,
        tier: "plus",
        term: "monthly",
        unlockedAt: "2026-06-01T00:00:00Z",
        compatibilityUsage: { month: "2026-07", productIds: [] },
      },
    });
    expect(result.scans).toEqual({
      v: 1,
      data: { scans: [{ createdAt: "2026-07-01T10:00:00Z" }] },
    });
    expect(result.checkins).toEqual({
      v: 1,
      data: { entries: [{ date: "2026-07-15" }] },
    });
  });

  it("marks a free-plan row as locked regardless of local claims", async () => {
    const { client } = fakeClient({
      single: {
        entitlements: { plan: "free", term: null, unlocked_at: null },
      },
    });
    const result = await pullAll(client, USER);
    expect(result.entitlement).toEqual({ v: 1, data: { unlocked: false } });
  });

  it("omits keys with no cloud data", async () => {
    const { client } = fakeClient();
    const result = await pullAll(client, USER);
    expect(result).toEqual({});
  });
});

describe("photoObjectKey", () => {
  it("scopes paths by owner for storage RLS", () => {
    expect(photoObjectKey("u1", "scan-a", "1-front.jpg")).toBe(
      "u1/scan-a/1-front.jpg",
    );
  });
});

/**
 * The `not.in` prune is the only query predicate in the repo assembled by string
 * interpolation. Its ids look client-generated, but they round-trip through the
 * database: pullAll reads `payload` jsonb back and pushScans re-derives the id
 * from `payload.createdAt`. RLS lets a user write arbitrary jsonb into their own
 * row, so an id can return carrying a `"` or `,` — which closes the quoted list
 * literal early and changes which rows the delete *excludes*.
 */
describe("prune filter safety", () => {
  function scansWithIds(ids: string[]) {
    return {
      v: 1,
      data: { scans: ids.map((id) => ({ createdAt: id, scanId: "s", photoNames: [] })) },
    };
  }

  it("builds the list literal for well-formed ISO ids", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "scans", scansWithIds(["2026-07-01T10:00:00Z"]));
    expect(calls.find((c) => c.op === "delete.not")?.args[2]).toBe(
      '("2026-07-01T10:00:00Z")',
    );
  });

  it.each([
    ['2026-07-01T10:00:00Z","', "an embedded quote closing the literal early"],
    ["2026-07-01T10:00:00Z,x", "an embedded comma adding a phantom element"],
    ['a")--', "a comment-style tail"],
    ["x".repeat(200), "an absurdly long id"],
    ["", "an empty id"],
  ])("skips the prune entirely for %j — %s", async (id) => {
    const { client, calls } = fakeClient();
    const result = await pushSnapshot(client, USER, "scans", scansWithIds([id]));

    // Fails closed: a stale row left behind is recoverable, rows deleted by a
    // truncated filter are not.
    expect(calls.some((c) => c.op === "delete.not")).toBe(false);
    expect(calls.some((c) => c.op === "delete.eq")).toBe(false);
    expect(result).toBe(true);
  });

  it("skips the prune if any one id in the batch is unsafe", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(
      client,
      USER,
      "scans",
      scansWithIds(["2026-07-01T10:00:00Z", 'evil","2026-07-08T10:00:00Z']),
    );
    expect(calls.some((c) => c.op === "delete.not")).toBe(false);
  });

  it("applies the same guard to the check-ins prune", async () => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, "checkins", {
      v: 1,
      data: {
        entries: [{ date: '2026-07-01","x', createdAt: "2026-07-01T10:00:00Z" }],
      },
    });
    expect(calls.some((c) => c.op === "delete.not")).toBe(false);
  });
});

describe("tenant scoping", () => {
  /**
   * RLS is the real boundary, but a query missing its user_id filter would rely
   * on RLS alone to be correct — and would silently become a cross-tenant read
   * the moment a policy was relaxed. Every call must carry the scope itself.
   */
  const keys = [
    "profile",
    "appearance",
    "log",
    "reminders",
    "entitlement",
    "scans",
    "checkins",
  ] as const;

  it.each(keys)("scopes every push for %s to the authenticated user", async (key) => {
    const { client, calls } = fakeClient();
    await pushSnapshot(client, USER, key, { v: 1, data: { scans: [], entries: [] } });

    expect(calls.length).toBeGreaterThan(0);
    for (const call of calls) {
      if (call.op === "upsert") {
        const payload = call.args[0];
        const rows = Array.isArray(payload) ? payload : [payload];
        for (const row of rows) {
          expect(row).toMatchObject({ user_id: USER });
        }
      } else if (call.op.startsWith("delete")) {
        const scoped = calls.some(
          (c) => c.op === "delete.eq" && c.args[0] === "user_id" && c.args[1] === USER,
        );
        expect(scoped).toBe(true);
      }
    }
  });

  it.each(keys)("scopes every remove for %s to the authenticated user", async (key) => {
    const { client, calls } = fakeClient();
    await removeSnapshot(client, USER, key);
    for (const call of calls) {
      if (call.op === "upsert") {
        expect(call.args[0]).toMatchObject({ user_id: USER });
      } else {
        expect(call.args[0]).toBe("user_id");
        expect(call.args[1]).toBe(USER);
      }
    }
  });
});
