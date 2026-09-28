/**
 * Read a request body under a hard byte ceiling.
 *
 * The previous guard on both routes was:
 *
 *   const declaredLength = Number(req.headers.get("content-length") ?? "");
 *   if (Number.isFinite(declaredLength) && declaredLength > MAX) reject
 *
 * `Number("")` is `0`, and `0 > MAX` is false — so a request that simply omits
 * `content-length` (any chunked `Transfer-Encoding` body) skipped the ceiling
 * entirely and went straight into an unbounded `req.json()`. The header is a
 * caller-supplied claim in the first place, so it can never be the real bound;
 * it is kept below only as the cheap pre-filter it always was.
 */

export type BoundedBody =
  | { ok: true; text: string }
  | { ok: false; reason: "too_large" | "unreadable" };

/**
 * Consume `req` and return its body as text, or fail once more than `maxBytes`
 * have been observed. Streaming means an oversized body is abandoned partway
 * rather than fully buffered first.
 */
export async function readBoundedBody(
  req: Request,
  maxBytes: number,
): Promise<BoundedBody> {
  // Cheap pre-filter: an honest client that declares an oversized body is
  // rejected without reading a single byte. A dishonest one is caught below.
  const declared = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, reason: "too_large" };
  }

  const body = req.body;
  if (!body) {
    // No stream (e.g. a synthesized Request in tests). Fall back to text() and
    // bound it after the fact — still a real bound, just less incremental.
    try {
      const text = await req.text();
      // Byte length, not string length: multi-byte UTF-8 must count fully.
      if (Buffer.byteLength(text, "utf8") > maxBytes) {
        return { ok: false, reason: "too_large" };
      }
      return { ok: true, text };
    } catch {
      return { ok: false, reason: "unreadable" };
    }
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        // Stop pulling immediately; do not keep buffering what we will reject.
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "too_large" };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: "unreadable" };
  }

  try {
    return { ok: true, text: Buffer.concat(chunks).toString("utf8") };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
