import { describe, expect, it } from "vitest";

import {
  MAX_CONCURRENT,
  MAX_PER_WINDOW,
  WINDOW_MS,
  check,
  clientKey,
  createStore,
} from "./rateLimit";

const T0 = 1_800_000_000_000;

describe("per-IP window", () => {
  it("allows up to the limit, then refuses", () => {
    const store = createStore();
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(check(store, "1.2.3.4", T0).allowed).toBe(true);
    }
    const blocked = check(store, "1.2.3.4", T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.allowed === false && blocked.reason).toBe("per_ip");
  });

  it("tells the caller how long to wait, in whole seconds", () => {
    const store = createStore();
    for (let i = 0; i < MAX_PER_WINDOW; i++) check(store, "1.2.3.4", T0);

    const halfway = check(store, "1.2.3.4", T0 + WINDOW_MS / 2);
    expect(halfway.allowed).toBe(false);
    if (halfway.allowed === false) {
      expect(halfway.retryAfterSeconds).toBe(WINDOW_MS / 2000);
      expect(Number.isInteger(halfway.retryAfterSeconds)).toBe(true);
    }
  });

  it("never advertises a zero-second wait at the very edge", () => {
    const store = createStore();
    for (let i = 0; i < MAX_PER_WINDOW; i++) check(store, "1.2.3.4", T0);
    const edge = check(store, "1.2.3.4", T0 + WINDOW_MS - 1);
    expect(edge.allowed === false && edge.retryAfterSeconds).toBe(1);
  });

  it("opens a fresh window once the old one has fully elapsed", () => {
    const store = createStore();
    for (let i = 0; i < MAX_PER_WINDOW; i++) check(store, "1.2.3.4", T0);
    expect(check(store, "1.2.3.4", T0 + WINDOW_MS).allowed).toBe(true);
  });

  it("counts each caller separately", () => {
    const store = createStore();
    for (let i = 0; i < MAX_PER_WINDOW; i++) check(store, "1.2.3.4", T0);
    expect(check(store, "5.6.7.8", T0).allowed).toBe(true);
  });

  // A stream of unique addresses must not become its own memory leak — that
  // would be a worse bug than the one this module exists to fix.
  it("evicts expired windows once the map grows large", () => {
    const store = createStore();
    for (let i = 0; i < 10_001; i++) check(store, `10.0.${i >> 8}.${i & 255}`, T0);
    check(store, "final", T0 + WINDOW_MS);
    expect(store.windows.size).toBeLessThan(10_001);
  });
});

describe("concurrency backstop", () => {
  // The per-IP limit cannot see the many-IPs-at-once case, and two sequential
  // Opus calls means a handful of concurrent requests is real money in flight.
  it("refuses once too many generations are already running", () => {
    const store = createStore();
    store.inFlight = MAX_CONCURRENT;
    const blocked = check(store, "fresh-caller", T0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.allowed === false && blocked.reason).toBe("busy");
  });

  it("does not consume the caller's per-IP budget when it refuses as busy", () => {
    const store = createStore();
    store.inFlight = MAX_CONCURRENT;
    check(store, "1.2.3.4", T0);
    store.inFlight = 0;
    for (let i = 0; i < MAX_PER_WINDOW; i++) {
      expect(check(store, "1.2.3.4", T0).allowed).toBe(true);
    }
  });
});

describe("clientKey", () => {
  it("takes the left-most forwarded address", () => {
    const h = new Headers({ "x-forwarded-for": "203.0.113.7, 70.41.3.18, 150.172.238.178" });
    expect(clientKey(h)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip, then to a shared bucket", () => {
    expect(clientKey(new Headers({ "x-real-ip": " 198.51.100.9 " }))).toBe("198.51.100.9");
    expect(clientKey(new Headers())).toBe("unknown");
  });
});
