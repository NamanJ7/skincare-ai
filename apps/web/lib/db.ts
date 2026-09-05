import { neon } from "@neondatabase/serverless";

/**
 * Tagged-template SQL client, or null when DATABASE_URL isn't set. Callers
 * (consent-store.ts) fall back to an in-memory store in that case -- same
 * "unset key -> mock" pattern as ANTHROPIC_API_KEY in pipeline.ts.
 */
export const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null;
