/**
 * Parental consent tokens — stateless, HMAC-signed, no datastore.
 *
 * A 16-17 year old cannot capture photos until a parent has actually received an
 * email and acted on it. The old screen took a parent's email and continued to
 * the camera without sending anything, which is a gate that only looks like one.
 *
 * There is no database in this repo, so the whole flow carries its state in a
 * signed token instead:
 *
 *   1. app  -> POST /api/consent/request  {parentEmail, age}
 *              server signs {emailHash, age, iat, exp} and emails the parent a
 *              link containing that token
 *   2. parent -> GET /consent/approve?token=...
 *              server verifies the signature, shows an approve page, and on
 *              approval reveals a 6-character code derived from the same secret
 *   3. teen -> POST /api/consent/verify   {token, code}
 *              server recomputes the code; a match is proof the parent opened
 *              the email
 *
 * The parent's email address is hashed into the token, never carried in it, so a
 * leaked link cannot be used to harvest addresses.
 *
 * FAILS CLOSED. Every helper here throws or returns false when CONSENT_SECRET is
 * missing or malformed. The caller must never interpret an error as approval —
 * the bug being fixed was exactly a gate that let people through when the check
 * did not happen.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/** A link is good for one day. Long enough for a parent to get to it, short
 *  enough that a forwarded email stops working. */
export const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/** No 0/O/1/I — this gets read aloud or copied by hand from a parent to a teen. */
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

export interface ConsentClaims {
  /** SHA-256 of the lowercased parent email, via HMAC. Never the address itself. */
  emailHash: string;
  /** The minor's declared age. Only 16 and 17 ever reach this flow. */
  age: number;
  issuedAt: number;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.CONSENT_SECRET;
  if (!value || value.length < 32) {
    throw new Error("CONSENT_SECRET is unset or shorter than 32 characters");
  }
  return value;
}

function hmac(input: string): Buffer {
  return createHmac("sha256", secret()).update(input).digest();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

/** Constant-time compare that tolerates length mismatch without leaking it. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function hashEmail(email: string): string {
  return hmac(`email:${email.trim().toLowerCase()}`).toString("base64url");
}

/** Sign a consent request. Throws when the secret is missing — never returns a
 *  token that cannot be verified. */
export function issueToken(parentEmail: string, age: number, now = Date.now()): string {
  const claims: ConsentClaims = {
    emailHash: hashEmail(parentEmail),
    age,
    issuedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  const body = b64url(JSON.stringify(claims));
  return `${body}.${b64url(hmac(`token:${body}`))}`;
}

/** Verify signature and expiry. Returns null on anything wrong — a malformed
 *  token, a bad signature, an expired one, or a missing secret. */
export function readToken(token: string, now = Date.now()): ConsentClaims | null {
  try {
    const [body, signature] = token.split(".");
    if (!body || !signature) return null;
    if (!safeEqual(signature, b64url(hmac(`token:${body}`)))) return null;

    const claims = JSON.parse(Buffer.from(body, "base64url").toString()) as ConsentClaims;
    if (typeof claims.expiresAt !== "number" || claims.expiresAt <= now) return null;
    if (claims.age !== 16 && claims.age !== 17) return null;
    return claims;
  } catch {
    return null;
  }
}

/**
 * The code the parent reads off the approval page. Derived from the token and
 * the secret, so it needs no storage and cannot be guessed without the secret.
 */
export function codeFor(token: string): string {
  const digest = hmac(`code:${token}`);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[digest[i]! % CODE_ALPHABET.length];
  }
  return out;
}

/** True only when the token is currently valid AND the code matches it. */
export function verifyCode(token: string, code: string, now = Date.now()): boolean {
  if (!readToken(token, now)) return false;
  return safeEqual(code.trim().toUpperCase(), codeFor(token));
}
