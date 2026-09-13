/**
 * Regression tests for the content-length bypass.
 *
 * The old guard read `Number(header ?? "")`, which is `0` when the header is
 * absent — and `0 > MAX` is false, so any chunked request skipped the ceiling
 * entirely and fell into an unbounded `req.json()`.
 */
import { describe, expect, it } from "vitest";

import { readBoundedBody } from "../read-bounded-body";

const MAX = 1_000;

function streamed(text: string, declareLength: boolean): Request {
  const bytes = new TextEncoder().encode(text);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      // Deliberately chunked, mirroring a Transfer-Encoding request.
      for (let i = 0; i < bytes.length; i += 64) {
        controller.enqueue(bytes.slice(i, i + 64));
      }
      controller.close();
    },
  });
  return new Request("https://pore.skin/api/plan", {
    method: "POST",
    headers: declareLength
      ? { "content-length": String(bytes.byteLength) }
      : {},
    body,
    // @ts-expect-error duplex is required by undici for a stream body.
    duplex: "half",
  });
}

describe("readBoundedBody", () => {
  it("accepts a body under the ceiling", async () => {
    const result = await readBoundedBody(streamed("hello", false), MAX);
    expect(result).toEqual({ ok: true, text: "hello" });
  });

  it("rejects an oversized body that declares its length", async () => {
    const result = await readBoundedBody(streamed("x".repeat(MAX + 1), true), MAX);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects an oversized body that omits content-length entirely", async () => {
    // This is the case the old `Number("") === 0` check let through.
    const result = await readBoundedBody(streamed("x".repeat(MAX * 4), false), MAX);
    expect(result).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects a body that lies about being small", async () => {
    const bytes = new TextEncoder().encode("x".repeat(MAX * 3));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    const req = new Request("https://pore.skin/api/plan", {
      method: "POST",
      // A caller-supplied claim of 10 bytes over a 3 KB body.
      headers: { "content-length": "10" },
      body,
      // @ts-expect-error duplex is required by undici for a stream body.
      duplex: "half",
    });

    expect(await readBoundedBody(req, MAX)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("counts bytes, not characters, for multi-byte input", async () => {
    // 400 × 3-byte characters = 1200 bytes, but only 400 string units.
    const text = "\u3042".repeat(400);
    expect(text.length).toBeLessThan(MAX);
    expect(await readBoundedBody(streamed(text, false), MAX)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });

  it("bounds a body with no stream via the text() fallback", async () => {
    const req = new Request("https://pore.skin/api/plan", {
      method: "POST",
      body: "y".repeat(MAX + 5),
    });
    Object.defineProperty(req, "body", { value: null });

    expect(await readBoundedBody(req, MAX)).toEqual({
      ok: false,
      reason: "too_large",
    });
  });
});
