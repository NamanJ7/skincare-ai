/**
 * Maps the app's AsyncStorage envelopes onto the Supabase schema
 * (supabase/migrations). Snapshot keys (profile, appearance, log, reminders)
 * store the whole envelope as jsonb so the client's version policy applies
 * unchanged on restore; record keys (scans, checkins) fan out into one row
 * per record. Entitlement pushes only the client-writable columns — plan/
 * term/unlocked_at are service-role-only in the database, so this module
 * physically cannot grant Plus.
 *
 * Every function resolves rather than throws: cloud sync is best-effort on
 * top of local-first storage and must never break the app.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { STORAGE_VERSION, type StoreKey } from "../storage";

export interface CloudEnvelope {
  v: number;
  data: unknown;
}

/** Minimal structural views of the persisted shapes this module fans out. */
interface ScanRecordLike {
  createdAt: string;
  scanId?: string;
  photoNames?: string[];
}
interface CheckInLike {
  date: string;
  createdAt: string;
  photoName?: string;
}
interface EntitlementLike {
  compatibilityUsage?: unknown;
  plusInterest?: unknown;
}

/** Deterministic storage object path for a photo, owner-scoped for RLS. */
export function photoObjectKey(
  userId: string,
  recordId: string,
  name: string,
): string {
  return `${userId}/${recordId}/${name}`;
}

/**
 * Ids *originate* as client-generated ISO timestamps or `YYYY-MM-DD` date keys,
 * but they do not stay that way: pullAll reads `payload` jsonb back out of
 * Postgres and pushScans/pushCheckins re-derive the id from `payload.createdAt`
 * / `payload.date`. RLS lets a user write arbitrary jsonb into their own row, so
 * an id can come back carrying a `"` or `,` — which terminates the quoted list
 * literal early and silently changes which rows the `not.in` excludes, turning
 * "delete what the device dropped" into a broader delete.
 *
 * So the charset is validated rather than assumed, and the builder fails closed:
 * null means "do not run this delete at all". A stale row left behind is
 * recoverable; rows deleted by a truncated filter are not.
 */
const SAFE_FILTER_ID = /^[A-Za-z0-9:.+_-]{1,64}$/;

function quotedInList(ids: string[]): string | null {
  if (!ids.every((id) => SAFE_FILTER_ID.test(id))) return null;
  return `(${ids.map((id) => `"${id}"`).join(",")})`;
}

async function upsertSnapshotColumn(
  client: SupabaseClient,
  table: "profiles" | "routine_logs" | "reminders",
  column: string,
  userId: string,
  envelope: CloudEnvelope | null,
): Promise<boolean> {
  const { error } = await client
    .from(table)
    .upsert({ user_id: userId, [column]: envelope }, { onConflict: "user_id" });
  return !error;
}

async function pushScans(
  client: SupabaseClient,
  userId: string,
  envelope: CloudEnvelope,
): Promise<boolean> {
  const data = envelope.data as { scans?: ScanRecordLike[] } | null;
  const records = data?.scans ?? [];
  const rows = records.map((record) => ({
    user_id: userId,
    id: record.createdAt,
    captured_at: record.createdAt,
    payload: record,
    photo_keys: (record.photoNames ?? []).map((name) =>
      photoObjectKey(userId, record.scanId ?? record.createdAt, name),
    ),
  }));
  if (rows.length > 0) {
    const { error } = await client
      .from("scans")
      .upsert(rows, { onConflict: "user_id,id" });
    if (error) return false;
  }
  // Remove rows for records deleted locally so restore mirrors the device.
  // The keep-list is resolved before the query is built: an unquotable id means
  // we cannot express "keep these" safely, and skipping the prune is the only
  // option that cannot delete a row we meant to keep.
  const keep = rows.length > 0 ? quotedInList(rows.map((row) => row.id)) : null;
  if (rows.length > 0 && !keep) return true;

  let query = client.from("scans").delete().eq("user_id", userId);
  if (keep) query = query.not("id", "in", keep);
  const { error: deleteError } = await query;
  return !deleteError;
}

async function pushCheckins(
  client: SupabaseClient,
  userId: string,
  envelope: CloudEnvelope,
): Promise<boolean> {
  const data = envelope.data as { entries?: CheckInLike[] } | null;
  const entries = data?.entries ?? [];
  const rows = entries.map((entry) => ({
    user_id: userId,
    id: entry.date,
    created_at: entry.createdAt,
    payload: entry,
    photo_keys: entry.photoName
      ? [photoObjectKey(userId, entry.date, entry.photoName)]
      : [],
  }));
  if (rows.length > 0) {
    const { error } = await client
      .from("checkins")
      .upsert(rows, { onConflict: "user_id,id" });
    if (error) return false;
  }
  const keep = rows.length > 0 ? quotedInList(rows.map((row) => row.id)) : null;
  if (rows.length > 0 && !keep) return true;

  let query = client.from("checkins").delete().eq("user_id", userId);
  if (keep) query = query.not("id", "in", keep);
  const { error: deleteError } = await query;
  return !deleteError;
}

async function pushEntitlement(
  client: SupabaseClient,
  userId: string,
  envelope: CloudEnvelope,
): Promise<boolean> {
  const data = (envelope.data ?? {}) as EntitlementLike;
  const { error } = await client.from("entitlements").upsert(
    {
      user_id: userId,
      compatibility_usage: data.compatibilityUsage ?? null,
      plus_interest: data.plusInterest ?? null,
    },
    { onConflict: "user_id" },
  );
  return !error;
}

/** Mirror one saved envelope to the cloud. Best-effort; false on any failure. */
export async function pushSnapshot(
  client: SupabaseClient,
  userId: string,
  key: StoreKey,
  envelope: CloudEnvelope,
): Promise<boolean> {
  try {
    switch (key) {
      case "profile":
        return await upsertSnapshotColumn(client, "profiles", "onboarding", userId, envelope);
      case "appearance":
        return await upsertSnapshotColumn(client, "profiles", "appearance", userId, envelope);
      case "log":
        return await upsertSnapshotColumn(client, "routine_logs", "data", userId, envelope);
      case "reminders":
        return await upsertSnapshotColumn(client, "reminders", "data", userId, envelope);
      case "entitlement":
        return await pushEntitlement(client, userId, envelope);
      case "scans":
        return await pushScans(client, userId, envelope);
      case "checkins":
        return await pushCheckins(client, userId, envelope);
    }
  } catch {
    return false;
  }
}

/** Mirror a local remove(). Snapshot columns null out; record rows delete. */
export async function removeSnapshot(
  client: SupabaseClient,
  userId: string,
  key: StoreKey,
): Promise<boolean> {
  try {
    switch (key) {
      case "profile":
        return await upsertSnapshotColumn(client, "profiles", "onboarding", userId, null);
      case "appearance":
        return await upsertSnapshotColumn(client, "profiles", "appearance", userId, null);
      case "log": {
        const { error } = await client.from("routine_logs").delete().eq("user_id", userId);
        return !error;
      }
      case "reminders": {
        const { error } = await client.from("reminders").delete().eq("user_id", userId);
        return !error;
      }
      case "entitlement": {
        const { error } = await client
          .from("entitlements")
          .upsert(
            { user_id: userId, compatibility_usage: null, plus_interest: null },
            { onConflict: "user_id" },
          );
        return !error;
      }
      case "scans": {
        const { error } = await client.from("scans").delete().eq("user_id", userId);
        return !error;
      }
      case "checkins": {
        const { error } = await client.from("checkins").delete().eq("user_id", userId);
        return !error;
      }
    }
  } catch {
    return false;
  }
}

function isEnvelope(value: unknown): value is CloudEnvelope {
  return (
    !!value &&
    typeof value === "object" &&
    typeof (value as CloudEnvelope).v === "number" &&
    "data" in (value as object)
  );
}

/**
 * Pull every cloud snapshot for a user, reassembled into the same envelopes
 * the local store holds. Missing tables/rows are simply absent from the
 * result; a network failure yields an empty object (caller falls back to
 * local — never blocks the app).
 */
export async function pullAll(
  client: SupabaseClient,
  userId: string,
): Promise<Partial<Record<StoreKey, CloudEnvelope>>> {
  const result: Partial<Record<StoreKey, CloudEnvelope>> = {};
  try {
    const [profileRes, logRes, remindersRes, entitlementRes, scansRes, checkinsRes] =
      await Promise.all([
        client.from("profiles").select("onboarding, appearance").eq("user_id", userId).maybeSingle(),
        client.from("routine_logs").select("data").eq("user_id", userId).maybeSingle(),
        client.from("reminders").select("data").eq("user_id", userId).maybeSingle(),
        client
          .from("entitlements")
          // Explicit columns, not `*`: this reads exactly the five fields the
          // destructure below uses, so a new column cannot start flowing into
          // local storage just because it was added to the table.
          .select("plan, term, unlocked_at, compatibility_usage, plus_interest")
          .eq("user_id", userId)
          .maybeSingle(),
        client.from("scans").select("payload").eq("user_id", userId).order("captured_at", { ascending: true }),
        client.from("checkins").select("payload").eq("user_id", userId).order("id", { ascending: true }),
      ]);

    if (isEnvelope(profileRes.data?.onboarding)) result.profile = profileRes.data.onboarding;
    if (isEnvelope(profileRes.data?.appearance)) result.appearance = profileRes.data.appearance;
    if (isEnvelope(logRes.data?.data)) result.log = logRes.data.data;
    if (isEnvelope(remindersRes.data?.data)) result.reminders = remindersRes.data.data;

    if (entitlementRes.data) {
      const row = entitlementRes.data as {
        plan?: string;
        term?: string | null;
        unlocked_at?: string | null;
        compatibility_usage?: unknown;
        plus_interest?: unknown;
      };
      result.entitlement = {
        v: STORAGE_VERSION,
        data: {
          // Server truth: only the billing service can have set plan='plus'.
          unlocked: row.plan === "plus",
          ...(row.plan === "plus" ? { tier: "plus" as const } : {}),
          ...(row.term ? { term: row.term } : {}),
          ...(row.unlocked_at ? { unlockedAt: row.unlocked_at } : {}),
          ...(row.compatibility_usage != null
            ? { compatibilityUsage: row.compatibility_usage }
            : {}),
          ...(row.plus_interest != null ? { plusInterest: row.plus_interest } : {}),
        },
      };
    }

    if (scansRes.data && scansRes.data.length > 0) {
      result.scans = {
        v: STORAGE_VERSION,
        data: { scans: scansRes.data.map((row) => row.payload) },
      };
    }
    if (checkinsRes.data && checkinsRes.data.length > 0) {
      result.checkins = {
        v: STORAGE_VERSION,
        data: { entries: checkinsRes.data.map((row) => row.payload) },
      };
    }
  } catch {
    return {};
  }
  return result;
}

/** Upload one photo's bytes to the private bucket. Caller resolves the path. */
export async function uploadPhoto(
  client: SupabaseClient,
  objectKey: string,
  bytes: ArrayBuffer,
  contentType = "image/jpeg",
): Promise<boolean> {
  try {
    const { error } = await client.storage
      .from("scan-photos")
      .upload(objectKey, bytes, { contentType, upsert: true });
    return !error;
  } catch {
    return false;
  }
}
