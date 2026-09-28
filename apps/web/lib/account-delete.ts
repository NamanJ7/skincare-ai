/**
 * Service-role side of account deletion.
 *
 * Talks to Supabase Storage and GoTrue Admin over raw fetch, matching the
 * existing approach in lib/quota.ts and lib/supabase-auth.ts — apps/web
 * deliberately does not depend on @supabase/supabase-js, so the service-role
 * key has no path into a client bundle.
 *
 * Every function here fails *closed and loud*: a failure returns `ok: false` so
 * the route can refuse rather than report a deletion it did not perform. On this
 * endpoint a false success is the worst possible outcome.
 */
import { safePublicHttpUrl } from "./safe-url";

/** Bound each admin round-trip so a slow datastore can't hang the handler. */
const ADMIN_TIMEOUT_MS = 10_000;

/** Storage list is paginated; cap total work so one account can't run forever. */
const LIST_PAGE_SIZE = 100;
const MAX_LIST_PAGES = 50;

const BUCKET = "scan-photos";

function config(): { url: string; key: string } | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // See lib/safe-url.ts: this URL is the base for service-role-keyed admin
  // calls, so an unsafe value counts as unconfigured rather than as a host to
  // send credentials to. adminConfigured() then reports false and the route
  // refuses instead of reporting a deletion it did not perform.
  const url = safePublicHttpUrl(process.env.SUPABASE_URL);
  if (!url || !key) return null;
  return { url: url.origin, key };
}

/** Whether the service-role credentials needed to delete an identity exist. */
export function adminConfigured(): boolean {
  return config() !== null;
}

function headers(key: string): Record<string, string> {
  return {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
}

interface StorageObject {
  name: string;
  id?: string | null;
}

/**
 * List one folder level under `prefix`. Supabase's list API returns synthetic
 * folder entries (id === null) alongside real objects, so callers must recurse.
 */
async function listFolder(
  cfg: { url: string; key: string },
  prefix: string,
  offset: number,
): Promise<StorageObject[]> {
  const res = await fetch(`${cfg.url}/storage/v1/object/list/${BUCKET}`, {
    method: "POST",
    headers: headers(cfg.key),
    body: JSON.stringify({
      prefix,
      limit: LIST_PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    }),
    cache: "no-store",
    // Admin/storage endpoints never legitimately redirect; following one would
    // replay the service-role key against another host.
    redirect: "error",
    signal: AbortSignal.timeout(ADMIN_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`storage list failed: ${res.status}`);
  const body = (await res.json()) as unknown;
  return Array.isArray(body) ? (body as StorageObject[]) : [];
}

/**
 * Remove every object under `{userId}/` in the private scan-photos bucket.
 *
 * The uid prefix is the same value every storage RLS policy checks
 * (`(storage.foldername(name))[1] = auth.uid()::text`), so scoping the walk to
 * that prefix is exactly the ownership boundary the database enforces. userId
 * comes from a verified token, never from caller input, so it cannot be
 * traversed into another namespace.
 */
export async function deleteScanPhotos(
  userId: string,
): Promise<{ ok: true; removed: number } | { ok: false; removed: 0 }> {
  const cfg = config();
  if (!cfg) return { ok: false, removed: 0 };

  try {
    const paths: string[] = [];
    // Breadth-first over {uid}/{scan_id}/{file}. Two levels in practice, but
    // the queue keeps this correct if the layout ever deepens.
    const queue: string[] = [`${userId}/`];
    let pages = 0;

    while (queue.length > 0 && pages < MAX_LIST_PAGES) {
      const prefix = queue.shift()!;
      let offset = 0;
      for (;;) {
        pages += 1;
        if (pages > MAX_LIST_PAGES) break;
        const entries = await listFolder(cfg, prefix, offset);
        for (const entry of entries) {
          if (!entry?.name) continue;
          // A null id marks a folder placeholder rather than a stored object.
          if (entry.id == null) queue.push(`${prefix}${entry.name}/`);
          else paths.push(`${prefix}${entry.name}`);
        }
        if (entries.length < LIST_PAGE_SIZE) break;
        offset += LIST_PAGE_SIZE;
      }
    }

    if (paths.length === 0) return { ok: true, removed: 0 };

    const res = await fetch(`${cfg.url}/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: headers(cfg.key),
      body: JSON.stringify({ prefixes: paths }),
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(ADMIN_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`storage delete failed: ${res.status}`);

    return { ok: true, removed: paths.length };
  } catch (err) {
    // Never echo the error to the caller; it can name internal hosts.
    console.error("deleteScanPhotos failed:", err);
    return { ok: false, removed: 0 };
  }
}

/**
 * Delete the auth identity. This cascades every user-owned row: all seven
 * product tables plus analysis_usage / analysis_requests declare
 * `references auth.users (id) on delete cascade`.
 *
 * A 404 is treated as success, not failure — deletion must be idempotent so a
 * client retrying after a dropped response does not see a permanent error on an
 * account that is already gone.
 */
export async function deleteAuthUser(
  userId: string,
): Promise<{ ok: true; alreadyGone: boolean } | { ok: false }> {
  const cfg = config();
  if (!cfg) return { ok: false };

  try {
    const res = await fetch(
      `${cfg.url}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      {
        method: "DELETE",
        headers: headers(cfg.key),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(ADMIN_TIMEOUT_MS),
      },
    );
    if (res.status === 404) return { ok: true, alreadyGone: true };
    if (!res.ok) throw new Error(`admin delete failed: ${res.status}`);
    return { ok: true, alreadyGone: false };
  } catch (err) {
    console.error("deleteAuthUser failed:", err);
    return { ok: false };
  }
}
