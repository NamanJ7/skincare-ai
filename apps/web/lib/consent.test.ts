/**
 * The consent gate decides whether a 16-17 year old's face reaches the camera.
 * These assertions are the ones that matter: it must fail closed on every path,
 * and a code must be unforgeable without the secret.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TOKEN_TTL_MS, codeFor, issueToken, readToken, verifyCode } from "./consent";

const SECRET = "x".repeat(48);
const OTHER_SECRET = "y".repeat(48);

beforeEach(() => {
  process.env.CONSENT_SECRET = SECRET;
});
afterEach(() => {
  delete process.env.CONSENT_SECRET;
});

describe("consent tokens", () => {
  it("round-trips a valid token", () => {
    const token = issueToken("parent@example.com", 16);
    const claims = readToken(token);
    expect(claims?.age).toBe(16);
    // The address itself must never travel in the token.
    expect(token).not.toContain("parent");
    expect(token).not.toContain("example.com");
  });

  it("rejects a tampered payload", () => {
    const token = issueToken("parent@example.com", 17);
    const [body, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ emailHash: "x", age: 17, issuedAt: 0, expiresAt: Date.now() + 1000 }),
    ).toString("base64url");
    expect(readToken(`${forged}.${sig}`)).toBeNull();
    expect(readToken(`${body}.${Buffer.from("nope").toString("base64url")}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueToken("parent@example.com", 16);
    process.env.CONSENT_SECRET = OTHER_SECRET;
    expect(readToken(token)).toBeNull();
    expect(verifyCode(token, codeFor(token))).toBe(false);
  });

  it("expires", () => {
    const now = 1_000_000;
    const token = issueToken("parent@example.com", 16, now);
    expect(readToken(token, now + TOKEN_TTL_MS - 1)).not.toBeNull();
    expect(readToken(token, now + TOKEN_TTL_MS + 1)).toBeNull();
  });

  it("only accepts the ages that route through this flow", () => {
    // 15 is blocked upstream and 18 never sees a consent screen; a token
    // claiming either means something is wrong, so it is not honoured.
    for (const age of [15, 18, 0, 99]) {
      expect(readToken(issueToken("p@e.com", age))).toBeNull();
    }
  });

  it("fails closed when the secret is missing or too weak", () => {
    const token = issueToken("parent@example.com", 16);
    delete process.env.CONSENT_SECRET;
    expect(() => issueToken("parent@example.com", 16)).toThrow();
    expect(readToken(token)).toBeNull();
    expect(verifyCode(token, "ABC123")).toBe(false);

    process.env.CONSENT_SECRET = "tooshort";
    expect(readToken(token)).toBeNull();
    expect(verifyCode(token, "ABC123")).toBe(false);
  });
});

describe("approval codes", () => {
  it("accepts the right code, case- and space-insensitively", () => {
    const token = issueToken("parent@example.com", 17);
    const code = codeFor(token);
    expect(code).toHaveLength(6);
    expect(verifyCode(token, code)).toBe(true);
    expect(verifyCode(token, `  ${code.toLowerCase()}  `)).toBe(true);
  });

  it("rejects a wrong code, and a code from a different token", () => {
    const token = issueToken("parent@example.com", 16);
    const other = issueToken("other@example.com", 16);
    expect(verifyCode(token, "AAAAAA")).toBe(false);
    expect(verifyCode(token, "")).toBe(false);
    expect(verifyCode(token, codeFor(other))).toBe(false);
  });

  it("uses an alphabet a parent can read aloud without ambiguity", () => {
    for (let i = 0; i < 200; i++) {
      expect(codeFor(issueToken(`p${i}@e.com`, 16))).toMatch(/^[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it("does not accept a code for an expired token", () => {
    const now = 1_000_000;
    const token = issueToken("parent@example.com", 16, now);
    expect(verifyCode(token, codeFor(token), now + TOKEN_TTL_MS + 1)).toBe(false);
  });
});
