/**
 * URL validation for anything this server is about to fetch.
 *
 * Today no endpoint fetches a caller-supplied URL — every outbound request goes
 * to `SUPABASE_URL` plus a hardcoded path, or to the Anthropic SDK's own host.
 * This module exists for two reasons:
 *
 *  1. `SUPABASE_URL` is configuration, and it is the base for requests that
 *     carry a service-role key. A typo'd or tampered value silently points that
 *     key at an arbitrary host, so it is validated before use rather than
 *     trusted because it "comes from us".
 *  2. The next endpoint that does take a URL from a request body should have
 *     something to reach for. Writing it after the fact is how SSRF ships.
 *
 * IMPORTANT — this is not, by itself, DNS-rebinding-safe. A hostname that
 * resolves to a public address here can resolve to 169.254.169.254 by the time
 * the socket opens. Validate-then-fetch only holds when the hostname is also
 * pinned to an allowlist (`allowHosts`), or when the caller pins the resolved
 * address at connect time. Callers fetching genuinely untrusted URLs must also
 * pass `redirect: "error"` (or "manual"), since a 302 to an internal address
 * bypasses every check made here.
 */

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

export interface SafeUrlOptions {
  /**
   * Exact hostnames permitted (case-insensitive). When set, anything else is
   * rejected — this is the only configuration that makes the check
   * rebinding-resistant, because the host is known ahead of time.
   */
  allowHosts?: string[];
  /**
   * Permit http:// and loopback addresses. Defaults to true outside production
   * so a local Supabase (`http://127.0.0.1:54321`) keeps working.
   */
  allowLoopback?: boolean;
}

/** Suffixes that never resolve to somewhere we intend to talk to. */
const BLOCKED_SUFFIXES = [".local", ".localhost", ".internal", ".home.arpa"];

function ipv4ToInt(host: string): number | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    value = value * 256 + octet;
  }
  return value;
}

interface Ipv4Range {
  label: string;
  /** Network address as an unsigned 32-bit int. */
  network: number;
  /** Prefix length. */
  bits: number;
}

/**
 * Reserved IPv4 space. Note that the WHATWG URL parser already normalises the
 * classic obfuscations for us — `http://2130706433`, `http://0177.0.0.1` and
 * `http://0x7f.0.0.1` all come out of `new URL(...).hostname` as `127.0.0.1` —
 * so this only has to reason about dotted-quad form.
 */
const IPV4_BLOCKED: Ipv4Range[] = [
  { label: "this-network", network: 0x00000000, bits: 8 }, // 0.0.0.0/8
  { label: "private", network: 0x0a000000, bits: 8 }, // 10.0.0.0/8
  { label: "shared/CGNAT", network: 0x64400000, bits: 10 }, // 100.64.0.0/10
  { label: "loopback", network: 0x7f000000, bits: 8 }, // 127.0.0.0/8
  { label: "link-local", network: 0xa9fe0000, bits: 16 }, // 169.254.0.0/16 — cloud metadata
  { label: "private", network: 0xac100000, bits: 12 }, // 172.16.0.0/12
  { label: "IETF protocol", network: 0xc0000000, bits: 24 }, // 192.0.0.0/24
  { label: "private", network: 0xc0a80000, bits: 16 }, // 192.168.0.0/16
  { label: "benchmark", network: 0xc6120000, bits: 15 }, // 198.18.0.0/15
  { label: "multicast", network: 0xe0000000, bits: 4 }, // 224.0.0.0/4
  { label: "reserved", network: 0xf0000000, bits: 4 }, // 240.0.0.0/4 (incl. broadcast)
];

function blockedIpv4(value: number): string | null {
  for (const range of IPV4_BLOCKED) {
    // Unsigned shift on both sides: a /4 network address does not fit a signed
    // int32, and `>>` would sign-extend it into a false mismatch.
    const shift = 32 - range.bits;
    if (value >>> shift === range.network >>> shift) return range.label;
  }
  return null;
}

/**
 * Expand an IPv6 literal to its 16 bytes, or null if it isn't one.
 *
 * Matching on the textual form does not work: the URL parser re-serialises
 * addresses into their canonical compressed hex, so `[::ffff:127.0.0.1]` is
 * already `[::ffff:7f00:1]` by the time we see it and a dotted-quad regex finds
 * nothing. Expanding to bytes is the only form the checks can be written
 * against without depending on how the input happened to be spelled.
 */
function parseIpv6(host: string): Uint8Array | null {
  let text = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!text.includes(":")) return null;

  // Fold an embedded dotted-quad tail into two hex groups first.
  const embedded = /:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(text);
  if (embedded) {
    const value = ipv4ToInt(embedded[1]!);
    if (value === null) return null;
    const high = ((value >>> 16) & 0xffff).toString(16);
    const low = (value & 0xffff).toString(16);
    text = `${text.slice(0, embedded.index)}:${high}:${low}`;
  }

  const parts = text.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const present = head.length + tail.length;
  if (present > 8) return null;
  // Without a `::` the address must be fully written out.
  if (parts.length === 1 && present !== 8) return null;

  const groups = [...head, ...Array<string>(8 - present).fill("0"), ...tail];
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 8; i++) {
    const group = groups[i]!;
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    const value = Number.parseInt(group, 16);
    bytes[i * 2] = value >>> 8;
    bytes[i * 2 + 1] = value & 0xff;
  }
  return bytes;
}

function blockedIpv6(host: string): string | null {
  const bytes = parseIpv6(host);
  if (!bytes) return null;
  const zeroThrough = (end: number) => bytes.slice(0, end).every((b) => b === 0);

  // IPv4-mapped (::ffff:0:0/96) and NAT64 (64:ff9b::/96) both reach IPv4 space
  // through an IPv6 literal, so what matters is the address they embed.
  const mapped = zeroThrough(10) && bytes[10] === 0xff && bytes[11] === 0xff;
  const nat64 =
    bytes[0] === 0x00 &&
    bytes[1] === 0x64 &&
    bytes[2] === 0xff &&
    bytes[3] === 0x9b &&
    bytes.slice(4, 12).every((b) => b === 0);
  if (mapped || nat64) {
    const value =
      bytes[12]! * 0x1000000 + bytes[13]! * 0x10000 + bytes[14]! * 0x100 + bytes[15]!;
    return blockedIpv4(value);
  }

  if (zeroThrough(16)) return "unspecified";
  if (zeroThrough(15) && bytes[15] === 1) return "loopback";
  if ((bytes[0]! & 0xfe) === 0xfc) return "unique-local"; // fc00::/7
  if (bytes[0] === 0xfe && (bytes[1]! & 0xc0) === 0x80) return "link-local"; // fe80::/10
  return null;
}

function isLoopbackHost(host: string): boolean {
  if (host === "localhost") return true;
  const value = ipv4ToInt(host);
  if (value !== null) return value >>> 24 === 127;
  return blockedIpv6(host) === "loopback";
}

/**
 * Returns the parsed URL, or throws `UnsafeUrlError`. Never returns a URL whose
 * host is loopback, private, link-local, CGNAT, multicast or reserved space, and
 * never one on a protocol other than http/https.
 */
export function assertPublicHttpUrl(
  raw: string,
  options: SafeUrlOptions = {},
): URL {
  const allowLoopback = options.allowLoopback ?? process.env.NODE_ENV !== "production";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("URL is not parseable");
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new UnsafeUrlError(`Protocol ${url.protocol} is not allowed`);
  }
  // Credentials in a URL are a redirect/proxy-confusion trick far more often
  // than they are a real requirement.
  if (url.username || url.password) {
    throw new UnsafeUrlError("URL must not contain credentials");
  }

  // Trailing dot is the same host to a resolver but a different string to a
  // naive allowlist, so normalise before any comparison.
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) throw new UnsafeUrlError("URL has no host");

  if (options.allowHosts && !options.allowHosts.some((h) => h.toLowerCase() === host)) {
    throw new UnsafeUrlError(`Host ${host} is not in the allowlist`);
  }

  if (isLoopbackHost(host)) {
    if (!allowLoopback) throw new UnsafeUrlError("Loopback addresses are not allowed");
    return url;
  }

  // http is permitted for loopback only (handled above). Everything else must be
  // TLS — otherwise a plaintext hop is a place to steal the credential we attach.
  if (url.protocol === "http:") {
    throw new UnsafeUrlError("Plaintext http is only allowed for loopback");
  }

  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) {
    throw new UnsafeUrlError(`Host ${host} resolves inside a private namespace`);
  }

  const ipv4 = ipv4ToInt(host);
  if (ipv4 !== null) {
    const blocked = blockedIpv4(ipv4);
    if (blocked) throw new UnsafeUrlError(`Host ${host} is in ${blocked} address space`);
  }

  const ipv6 = blockedIpv6(url.hostname);
  if (ipv6) throw new UnsafeUrlError(`Host ${host} is in ${ipv6} address space`);

  return url;
}

/** Non-throwing form, for config paths that must simply treat bad input as absent. */
export function safePublicHttpUrl(
  raw: string | undefined,
  options: SafeUrlOptions = {},
): URL | null {
  if (!raw) return null;
  try {
    return assertPublicHttpUrl(raw, options);
  } catch {
    return null;
  }
}
