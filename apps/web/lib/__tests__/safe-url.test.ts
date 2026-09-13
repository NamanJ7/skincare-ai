/**
 * SSRF guard. No endpoint fetches a caller-supplied URL today, so these tests
 * are the specification for the one that eventually will — and the pin on the
 * config path that already uses it (SUPABASE_URL, which carries a project key).
 *
 * The IPv4-obfuscation cases matter most: they document that the WHATWG URL
 * parser normalises `2130706433` / `0177.0.0.1` / `0x7f.0.0.1` to `127.0.0.1`
 * before we ever see them. If that assumption were wrong, every decimal/octal/
 * hex bypass would sail straight through, and nothing else in the module would
 * catch it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { UnsafeUrlError, assertPublicHttpUrl, safePublicHttpUrl } from "../safe-url";

const PROD = { allowLoopback: false } as const;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("assertPublicHttpUrl", () => {
  it.each([
    "https://example.supabase.co",
    "https://example.supabase.co/rest/v1/rpc/claim_analysis_slot",
    "https://8.8.8.8/health",
    "https://sub.domain.example.com:8443/path?q=1",
  ])("accepts public https URL %s", (url) => {
    expect(() => assertPublicHttpUrl(url, PROD)).not.toThrow();
  });

  it.each([
    ["javascript:alert(1)", "javascript"],
    ["data:text/html,<script>alert(1)</script>", "data"],
    ["file:///etc/passwd", "file"],
    ["gopher://example.com/", "gopher"],
    ["ftp://example.com/", "ftp"],
  ])("rejects %s (%s scheme)", (url) => {
    expect(() => assertPublicHttpUrl(url, PROD)).toThrow(UnsafeUrlError);
  });

  it("rejects unparseable input", () => {
    expect(() => assertPublicHttpUrl("not a url", PROD)).toThrow(UnsafeUrlError);
    expect(() => assertPublicHttpUrl("", PROD)).toThrow(UnsafeUrlError);
  });

  it("rejects credentials embedded in the URL", () => {
    // `https://trusted.com@evil.com/` is a host of evil.com wearing a costume.
    expect(() => assertPublicHttpUrl("https://user:pw@example.com/", PROD)).toThrow(
      /credentials/,
    );
    expect(() => assertPublicHttpUrl("https://example.supabase.co@evil.com/", PROD))
      .toThrow(/credentials/);
  });

  describe("private and reserved address space", () => {
    it.each([
      ["https://127.0.0.1/", "loopback"],
      ["https://127.53.1.9/", "loopback (whole /8)"],
      ["https://10.0.0.1/", "10/8"],
      ["https://10.255.255.254/", "10/8 upper"],
      ["https://172.16.0.1/", "172.16/12"],
      ["https://172.31.255.254/", "172.16/12 upper"],
      ["https://192.168.1.1/", "192.168/16"],
      ["https://169.254.169.254/", "cloud metadata"],
      ["https://169.254.0.1/", "link-local"],
      ["https://100.64.0.1/", "CGNAT"],
      ["https://0.0.0.0/", "this-network"],
      ["https://192.0.0.1/", "IETF protocol assignments"],
      ["https://198.18.0.1/", "benchmark"],
      ["https://224.0.0.1/", "multicast"],
      ["https://255.255.255.255/", "broadcast"],
    ])("rejects %s — %s", (url) => {
      expect(() => assertPublicHttpUrl(url, PROD)).toThrow(UnsafeUrlError);
    });

    it.each([
      ["https://172.15.0.1/", "just below 172.16/12"],
      ["https://172.32.0.1/", "just above 172.16/12"],
      ["https://100.63.255.255/", "just below CGNAT"],
      ["https://100.128.0.1/", "just above CGNAT"],
      ["https://11.0.0.1/", "just above 10/8"],
      ["https://223.255.255.255/", "just below multicast"],
    ])("does not over-block %s — %s", (url) => {
      expect(() => assertPublicHttpUrl(url, PROD)).not.toThrow();
    });
  });

  describe("obfuscated IPv4", () => {
    it.each([
      ["https://2130706433/", "decimal 127.0.0.1"],
      ["https://0177.0.0.1/", "octal"],
      ["https://0x7f.0.0.1/", "hex"],
      ["https://0x7f000001/", "hex packed"],
      ["https://127.1/", "short form"],
    ])("rejects %s — %s", (url) => {
      expect(() => assertPublicHttpUrl(url, PROD)).toThrow(UnsafeUrlError);
    });

    it("normalises through the URL parser, which is what makes the above work", () => {
      expect(new URL("https://2130706433/").hostname).toBe("127.0.0.1");
      expect(new URL("https://0177.0.0.1/").hostname).toBe("127.0.0.1");
    });
  });

  describe("IPv6", () => {
    it.each([
      ["https://[::1]/", "loopback"],
      ["https://[::]/", "unspecified"],
      ["https://[fc00::1]/", "unique-local"],
      ["https://[fd12:3456::1]/", "unique-local"],
      ["https://[fe80::1]/", "link-local"],
      ["https://[::ffff:127.0.0.1]/", "IPv4-mapped loopback"],
      ["https://[::ffff:169.254.169.254]/", "IPv4-mapped metadata"],
      ["https://[64:ff9b::10.0.0.1]/", "NAT64 to private space"],
    ])("rejects %s — %s", (url) => {
      expect(() => assertPublicHttpUrl(url, PROD)).toThrow(UnsafeUrlError);
    });

    it("accepts a public IPv6 literal", () => {
      expect(() => assertPublicHttpUrl("https://[2606:4700::1111]/", PROD)).not.toThrow();
    });
  });

  describe("private namespaces", () => {
    it.each([
      "https://localhost/",
      "https://api.local/",
      "https://db.internal/",
      "https://thing.home.arpa/",
      "https://foo.localhost/",
    ])("rejects %s", (url) => {
      expect(() => assertPublicHttpUrl(url, PROD)).toThrow(UnsafeUrlError);
    });

    it("normalises a trailing dot so it cannot dodge a suffix check", () => {
      expect(() => assertPublicHttpUrl("https://db.internal./", PROD)).toThrow(
        UnsafeUrlError,
      );
    });
  });

  describe("protocol", () => {
    it("rejects plaintext http to a public host", () => {
      expect(() => assertPublicHttpUrl("http://example.com/", PROD)).toThrow(
        /Plaintext http/,
      );
      // Still rejected in dev: only loopback earns the http exemption.
      expect(() => assertPublicHttpUrl("http://example.com/", { allowLoopback: true }))
        .toThrow(/Plaintext http/);
    });

    it("allows http to loopback when loopback is allowed (local Supabase)", () => {
      expect(() =>
        assertPublicHttpUrl("http://127.0.0.1:54321", { allowLoopback: true }),
      ).not.toThrow();
    });

    it("defaults allowLoopback from NODE_ENV", () => {
      vi.stubEnv("NODE_ENV", "production");
      expect(() => assertPublicHttpUrl("http://localhost:54321")).toThrow(UnsafeUrlError);
      vi.stubEnv("NODE_ENV", "development");
      expect(() => assertPublicHttpUrl("http://localhost:54321")).not.toThrow();
    });
  });

  describe("allowHosts", () => {
    it("rejects a public host that is not on the list", () => {
      expect(() =>
        assertPublicHttpUrl("https://evil.com/", {
          ...PROD,
          allowHosts: ["example.supabase.co"],
        }),
      ).toThrow(/allowlist/);
    });

    it("accepts a listed host case-insensitively", () => {
      expect(() =>
        assertPublicHttpUrl("https://Example.Supabase.CO/x", {
          ...PROD,
          allowHosts: ["example.supabase.co"],
        }),
      ).not.toThrow();
    });

    it("still rejects a listed host that resolves to private space", () => {
      // The allowlist is an extra constraint, never a bypass.
      expect(() =>
        assertPublicHttpUrl("https://127.0.0.1/", { ...PROD, allowHosts: ["127.0.0.1"] }),
      ).toThrow(UnsafeUrlError);
    });
  });
});

describe("safePublicHttpUrl", () => {
  it("returns null instead of throwing, for config paths", () => {
    expect(safePublicHttpUrl(undefined)).toBeNull();
    expect(safePublicHttpUrl("")).toBeNull();
    expect(safePublicHttpUrl("http://169.254.169.254/", PROD)).toBeNull();
    expect(safePublicHttpUrl("https://example.supabase.co", PROD)?.origin).toBe(
      "https://example.supabase.co",
    );
  });
});
