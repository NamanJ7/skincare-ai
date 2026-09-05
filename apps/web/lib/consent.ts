/**
 * Verifiable parental consent for under-18 users, gating the photo pipeline.
 *
 * age 16-17 -> mobile app posts here -> parent gets one emailed link -> they
 * approve/deny on a web page -> /api/plan refuses to run for that user's
 * intake until the linked request is "approved". See consent-store.ts for
 * the persistence (Postgres, or an in-memory fallback when DATABASE_URL is
 * unset) and email.ts for delivery (Resend, or console.log when
 * RESEND_API_KEY is unset).
 */
import type { ConsentStatus } from "@pore/shared";
import {
  generateConsentId,
  generateConsentToken,
  getConsentById,
  insertConsent,
  updateConsentStatus,
} from "./consent-store";
import { sendConsentEmail } from "./email";

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";

export interface CreateConsentInput {
  parentEmail: string;
  childAge: number;
}

export async function createConsentRequest(input: CreateConsentInput): Promise<{ id: string }> {
  const id = generateConsentId();
  const token = generateConsentToken();

  await insertConsent({
    id,
    token,
    parentEmail: input.parentEmail,
    childAge: input.childAge,
    status: "pending",
    createdAt: new Date().toISOString(),
    decidedAt: null,
  });

  const approveUrl = `${APP_BASE_URL}/consent/${id}?token=${token}`;
  await sendConsentEmail({ to: input.parentEmail, childAge: input.childAge, approveUrl });

  return { id };
}

/** For the mobile app's poll -- id only, no token, since status alone isn't
 *  sensitive and the id is an unguessable UUID. */
export async function getConsentStatus(id: string): Promise<ConsentStatus | null> {
  const record = await getConsentById(id);
  return record?.status ?? null;
}

/** For the parent-facing web page -- requires the emailed token so the id
 *  alone can't reveal the parent's email or child's age. */
export async function getConsentForApproval(
  id: string,
  token: string,
): Promise<{ status: ConsentStatus; childAge: number } | null> {
  const record = await getConsentById(id);
  if (!record || record.token !== token) return null;
  return { status: record.status, childAge: record.childAge };
}

export async function respondToConsent(
  id: string,
  token: string,
  decision: "approve" | "deny",
): Promise<ConsentStatus | null> {
  const status: ConsentStatus = decision === "approve" ? "approved" : "denied";
  const updated = await updateConsentStatus(id, token, status);
  return updated?.status ?? null;
}

/** Server-side enforcement for /api/plan: an under-18 intake needs an
 *  approved consent request, and it must actually belong to this session
 *  (the mobile app must have submitted a matching parentEmail). Skipping the
 *  UI's own gate doesn't help -- the pipeline itself refuses to run. */
export async function isConsentApproved(consentId: string, parentEmail: string): Promise<boolean> {
  const record = await getConsentById(consentId);
  return record?.status === "approved" && record.parentEmail === parentEmail;
}
