import { randomBytes, randomUUID } from "node:crypto";
import type { ConsentStatus } from "@pore/shared";
import { sql } from "./db";

export interface ConsentRecord {
  id: string;
  token: string;
  parentEmail: string;
  childAge: number;
  status: ConsentStatus;
  createdAt: string;
  decidedAt: string | null;
}

// In-memory fallback used when DATABASE_URL is unset (see db.ts). Not shared
// across serverless invocations or restarts -- dev/testing only. Stashed on
// globalThis rather than a plain module-scope variable: Next.js dev
// (Turbopack) compiles route handlers and server-component pages as separate
// module graphs, so each would otherwise get its own instance of this file
// and never see the other's writes. globalThis is the one thing guaranteed
// to be the same object across every bundle in the process.
declare global {
  var __poreConsentMemoryStore: Map<string, ConsentRecord> | undefined;
}
const memoryStore = globalThis.__poreConsentMemoryStore ?? new Map<string, ConsentRecord>();
globalThis.__poreConsentMemoryStore = memoryStore;

export function generateConsentId(): string {
  return randomUUID();
}

export function generateConsentToken(): string {
  return randomBytes(32).toString("hex");
}

export async function insertConsent(record: ConsentRecord): Promise<void> {
  if (!sql) {
    memoryStore.set(record.id, record);
    return;
  }
  await sql`
    insert into parental_consents (id, token, parent_email, child_age, status, created_at)
    values (${record.id}, ${record.token}, ${record.parentEmail}, ${record.childAge}, ${record.status}, ${record.createdAt})
  `;
}

export async function getConsentById(id: string): Promise<ConsentRecord | null> {
  if (!sql) {
    return memoryStore.get(id) ?? null;
  }
  const rows = await sql`select * from parental_consents where id = ${id}`;
  return rows[0] ? rowToRecord(rows[0]) : null;
}

/**
 * Atomically flips a pending request to approved/denied. Requires the
 * emailed token so guessing (or leaking) the id alone can't decide it, and
 * only succeeds once -- a second call against an already-decided request is
 * a no-op that returns null.
 */
export async function updateConsentStatus(
  id: string,
  token: string,
  status: Extract<ConsentStatus, "approved" | "denied">,
): Promise<ConsentRecord | null> {
  if (!sql) {
    const existing = memoryStore.get(id);
    if (!existing || existing.token !== token || existing.status !== "pending") return null;
    const updated: ConsentRecord = { ...existing, status, decidedAt: new Date().toISOString() };
    memoryStore.set(id, updated);
    return updated;
  }
  const rows = await sql`
    update parental_consents
    set status = ${status}, decided_at = now()
    where id = ${id} and token = ${token} and status = 'pending'
    returning *
  `;
  return rows[0] ? rowToRecord(rows[0]) : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToRecord(row: any): ConsentRecord {
  return {
    id: row.id,
    token: row.token,
    parentEmail: row.parent_email,
    childAge: row.child_age,
    status: row.status,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    decidedAt: row.decided_at instanceof Date ? row.decided_at.toISOString() : row.decided_at,
  };
}
