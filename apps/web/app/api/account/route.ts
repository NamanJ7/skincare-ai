/**
 * Account deletion.
 *
 * Apple Guideline 5.1.1(v) requires any app that supports account creation to
 * offer in-app account deletion. Pore creates real `auth.users` rows (anonymous
 * at boot, then converted in place on sign-up), so "Delete my data" clearing
 * AsyncStorage was never sufficient: it left the auth identity live and a full
 * copy of the user's skin assessments and scan findings server-side.
 *
 * The identity deleted here comes *only* from the verified bearer token. There
 * is no user id in the body, the path, or a query param, which is what makes
 * cross-user deletion structurally impossible rather than merely checked.
 */
import { hashIp, checkRateLimit, trustedClientIp } from "@/lib/rate-limit";
import {
  deleteAuthUser,
  deleteScanPhotos,
  adminConfigured,
} from "@/lib/account-delete";
import { corsHeaders, preflightResponse } from "@/lib/cors";
import { verifyBearer } from "@/lib/supabase-auth";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" } as const;

function fail(status: number, error: string, code: string): Response {
  return Response.json({ error, code }, { status, headers: NO_STORE_HEADERS });
}

/** One structured line per request. Never the email, never the token. */
function logOutcome(fields: Record<string, string | number | boolean>): void {
  console.log(JSON.stringify({ route: "/api/account", ...fields }));
}

/**
 * Preflight. Emits a policy only for an explicitly allowlisted origin; with
 * ALLOWED_ORIGINS unset (the production default) this is a bare 405 — exactly
 * what Next returned before an OPTIONS export existed here.
 */
export async function OPTIONS(req: Request) {
  return preflightResponse(req, ["DELETE"]);
}

/**
 * CORS is applied once, to whatever the handler returned, so a failure response
 * carries the same policy as a success — a browser that cannot read the body of
 * a 401 reports it as an opaque network error instead.
 */
export async function DELETE(req: Request) {
  const res = await handleDelete(req);
  for (const [key, value] of Object.entries(corsHeaders(req))) {
    res.headers.set(key, value);
  }
  return res;
}

async function handleDelete(req: Request): Promise<Response> {
  const startedAt = Date.now();

  // Identity first. Unlike /api/plan this endpoint is destructive rather than
  // expensive, but it fails closed for the same reason: an unverifiable caller
  // must never reach a delete.
  const auth = await verifyBearer(req);
  if (auth.kind === "invalid") {
    logOutcome({ outcome: "unauthenticated" });
    return fail(401, "Sign-in is required to delete an account.", "UNAUTHENTICATED");
  }
  if (auth.kind === "unavailable") {
    logOutcome({ outcome: "auth_unavailable" });
    return fail(
      503,
      "Account deletion is briefly unavailable. Try again shortly.",
      "DELETE_UNAVAILABLE",
    );
  }
  if (auth.kind !== "user") {
    // devBypass has no identity to delete; refuse rather than guess.
    logOutcome({ outcome: "no_identity" });
    return fail(401, "Sign-in is required to delete an account.", "UNAUTHENTICATED");
  }

  const userId = auth.userId;

  // Deletion is cheap but not free, and it is a nice denial-of-service primitive
  // if someone can spin it. Same bucket module as the paid path.
  if (!checkRateLimit(`account-delete:${userId}`)) {
    logOutcome({ outcome: "rate_limited", userId });
    return fail(429, "Too many deletion attempts. Try again in a minute.", "RATE_LIMITED");
  }

  if (!adminConfigured()) {
    // No service-role key means we cannot delete the auth identity. Reporting
    // success here would be the worst possible lie on this endpoint.
    logOutcome({ outcome: "unconfigured", userId });
    return fail(
      503,
      "Account deletion is briefly unavailable. Try again shortly.",
      "DELETE_UNAVAILABLE",
    );
  }

  // Storage first: once the auth row is gone the objects are orphaned with no
  // owner to attribute them to, and the RLS policies key on the uid prefix.
  const photos = await deleteScanPhotos(userId);
  if (!photos.ok) {
    logOutcome({ outcome: "storage_failed", userId });
    return fail(
      500,
      "Could not finish deleting your account. Nothing was partially removed — please try again.",
      "DELETE_FAILED",
    );
  }

  // Cascades every row in profiles/scans/routines/routine_logs/checkins/
  // entitlements/reminders/analysis_* — all of them declare
  // `references auth.users (id) on delete cascade`.
  const deleted = await deleteAuthUser(userId);
  if (!deleted.ok) {
    logOutcome({ outcome: "auth_delete_failed", userId });
    return fail(
      500,
      "Could not finish deleting your account. Please try again.",
      "DELETE_FAILED",
    );
  }

  // Omitted entirely when no salt is configured — see hashIp.
  const ipHash = hashIp(trustedClientIp(req));
  logOutcome({
    outcome: "deleted",
    userId,
    objectsRemoved: photos.removed,
    alreadyGone: deleted.alreadyGone,
    ...(ipHash ? { ipHash } : {}),
    durationMs: Date.now() - startedAt,
  });

  return Response.json(
    { ok: true, objectsRemoved: photos.removed },
    { headers: NO_STORE_HEADERS },
  );
}
