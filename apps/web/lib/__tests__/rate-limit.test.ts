import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  clearRateLimits,
  hashIp,
  trustedClientIp,
} from "../rate-limit";

const T0 = 1_700_000_000_000;

beforeEach(() => {
  clearRateLimits();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function request(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/plan", { headers });
}

describe("checkRateLimit", () => {
  it("allows a burst of 3 and then rejects", () => {
    expect(checkRateLimit("a", T0)).toBe(true);
    expect(checkRateLimit("a", T0)).toBe(true);
    expect(checkRateLimit("a", T0)).toBe(true);
    expect(checkRateLimit("a", T0)).toBe(false);
  });

  it("refills one token per minute", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", T0);
    expect(checkRateLimit("a", T0 + 30_000)).toBe(false);
    expect(checkRateLimit("a", T0 + 61_000)).toBe(true);
    expect(checkRateLimit("a", T0 + 62_000)).toBe(false);
  });

  it("caps refill at capacity after a long idle period", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", T0);
    const later = T0 + 60 * 60_000;
    expect(checkRateLimit("a", later)).toBe(true);
    expect(checkRateLimit("a", later)).toBe(true);
    expect(checkRateLimit("a", later)).toBe(true);
    expect(checkRateLimit("a", later)).toBe(false);
  });

  it("isolates buckets per key", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("a", T0);
    expect(checkRateLimit("a", T0)).toBe(false);
    expect(checkRateLimit("b", T0)).toBe(true);
  });

  // Regression: eviction used to run in insertion order, so flooding the map
  // with fresh keys evicted the attacker's own exhausted bucket and handed
  // back full capacity. LRU ordering must keep a recently-used bucket alive.
  it("does not restore an exhausted bucket by flooding new keys", () => {
    for (let i = 0; i < 3; i++) checkRateLimit("victim", T0);
    expect(checkRateLimit("victim", T0)).toBe(false);

    for (let i = 0; i < 12_000; i++) {
      checkRateLimit(`flood-${i}`, T0);
      // Keep touching the exhausted bucket: as the most recently used key it
      // must never be the one evicted.
      if (i % 500 === 0) expect(checkRateLimit("victim", T0)).toBe(false);
    }

    expect(checkRateLimit("victim", T0)).toBe(false);
  });
});

describe("trustedClientIp", () => {
  // The core C1 regression. `x-forwarded-for` is a caller-writable chain and
  // proxies append, so hop 0 is attacker text. Reading it meant one curl flag
  // minted unlimited fresh rate-limit buckets against a paid endpoint.
  it("ignores a client-supplied first hop", () => {
    const a = trustedClientIp(
      request({ "x-forwarded-for": "1.1.1.1, 203.0.113.7" }),
    );
    const b = trustedClientIp(
      request({ "x-forwarded-for": "2.2.2.2, 203.0.113.7" }),
    );
    const c = trustedClientIp(
      request({ "x-forwarded-for": "evil-spoof, 203.0.113.7" }),
    );
    expect(a).toBe("203.0.113.7");
    expect(b).toBe("203.0.113.7");
    expect(c).toBe("203.0.113.7");
    // All three spoof attempts collapse onto one bucket.
    expect(new Set([a, b, c]).size).toBe(1);
  });

  it("spoofed hops cannot buy extra requests", () => {
    for (let i = 0; i < 3; i++) {
      const key = trustedClientIp(
        request({ "x-forwarded-for": `spoof-${i}, 203.0.113.7` }),
      );
      expect(checkRateLimit(key, T0)).toBe(true);
    }
    const key = trustedClientIp(
      request({ "x-forwarded-for": "spoof-99, 203.0.113.7" }),
    );
    expect(checkRateLimit(key, T0)).toBe(false);
  });

  it("prefers the platform-set header over the writable chain — on Vercel", () => {
    vi.stubEnv("VERCEL", "1");
    expect(
      trustedClientIp(
        request({
          "x-vercel-forwarded-for": "198.51.100.9",
          "x-forwarded-for": "spoof, 203.0.113.7",
        }),
      ),
    ).toBe("198.51.100.9");
  });

  /**
   * `x-vercel-forwarded-for` and `x-real-ip` are single-valued, so unlike the
   * `x-forwarded-for` chain there is no "part our infrastructure wrote" to read
   * from. They are only meaningful when an edge we operate is guaranteed to
   * have set them. Off-platform they are plain caller text — and because
   * hashIp() of this value is what lands in analysis_requests.ip_hash, trusting
   * them let a caller choose the pseudonym recorded in their own audit trail.
   */
  it("ignores the platform header when not running on a trusted platform", () => {
    expect(
      trustedClientIp(
        request({
          "x-vercel-forwarded-for": "198.51.100.9",
          "x-forwarded-for": "spoof, 203.0.113.7",
        }),
      ),
    ).toBe("203.0.113.7");
  });

  it("spoofed platform headers cannot mint fresh buckets off-platform", () => {
    for (let i = 0; i < 3; i++) {
      const key = trustedClientIp(request({ "x-vercel-forwarded-for": `spoof-${i}` }));
      expect(checkRateLimit(key, T0)).toBe(true);
    }
    // All four collapse onto SHARED_KEY rather than four fresh buckets.
    expect(
      checkRateLimit(trustedClientIp(request({ "x-vercel-forwarded-for": "spoof-9" })), T0),
    ).toBe(false);
  });

  it("accepts an explicit opt-in for an equivalent edge elsewhere", () => {
    vi.stubEnv("TRUST_PLATFORM_FORWARDED_HEADER", "true");
    expect(
      trustedClientIp(request({ "x-vercel-forwarded-for": "198.51.100.9" })),
    ).toBe("198.51.100.9");
  });

  it("honours TRUSTED_PROXY_HOPS for deeper proxy chains", () => {
    vi.stubEnv("TRUSTED_PROXY_HOPS", "2");
    expect(
      trustedClientIp(
        request({ "x-forwarded-for": "spoof, 203.0.113.7, 10.0.0.1" }),
      ),
    ).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip on a trusted platform, then to one shared key", () => {
    vi.stubEnv("VERCEL", "1");
    expect(trustedClientIp(request({ "x-real-ip": "203.0.113.5" }))).toBe(
      "203.0.113.5",
    );
    expect(trustedClientIp(request({}))).toBe("unidentified");
  });

  it("ignores x-real-ip off-platform, collapsing to the shared key", () => {
    expect(trustedClientIp(request({ "x-real-ip": "203.0.113.5" }))).toBe(
      "unidentified",
    );
  });

  it("collapses every unidentifiable caller onto the same bucket", () => {
    const key = trustedClientIp(request({}));
    for (let i = 0; i < 3; i++) expect(checkRateLimit(key, T0)).toBe(true);
    expect(checkRateLimit(trustedClientIp(request({})), T0)).toBe(false);
  });
});

describe("hashIp", () => {
  it("is stable, salted, and does not leak the address", () => {
    vi.stubEnv("IP_HASH_SALT", "salt-a-long-enough-to-be-real");
    const first = hashIp("203.0.113.7");
    expect(first).toBe(hashIp("203.0.113.7"));
    expect(first).not.toContain("203.0.113.7");

    vi.stubEnv("IP_HASH_SALT", "salt-b-long-enough-to-be-real");
    expect(hashIp("203.0.113.7")).not.toBe(first);
  });
});

describe("hashIp salt requirement", () => {
  /**
   * The migration comment on analysis_requests.ip_hash promises "salted hash
   * only. A raw IP is personal data we have no reason to retain." An empty or
   * token salt does not deliver that: SHA-256 over the 2^32 IPv4 space is a
   * seconds-long rainbow table, so the stored value is the address itself with
   * extra steps.
   */
  it("returns null when no salt is configured", () => {
    vi.stubEnv("IP_HASH_SALT", "");
    expect(hashIp("203.0.113.7")).toBeNull();
  });

  it("returns null for a salt too short to be worth anything", () => {
    vi.stubEnv("IP_HASH_SALT", "short");
    expect(hashIp("203.0.113.7")).toBeNull();
  });

  it("hashes once a real salt is present", () => {
    vi.stubEnv("IP_HASH_SALT", "a-sufficiently-long-random-salt");
    const hashed = hashIp("203.0.113.7");
    expect(hashed).toMatch(/^[0-9a-f]{32}$/);
    expect(hashed).not.toContain("203.0.113.7");
  });

  it("produces different digests under different salts", () => {
    vi.stubEnv("IP_HASH_SALT", "salt-number-one-is-long-enough");
    const first = hashIp("203.0.113.7");
    vi.stubEnv("IP_HASH_SALT", "salt-number-two-is-long-enough");
    expect(hashIp("203.0.113.7")).not.toBe(first);
  });
});
