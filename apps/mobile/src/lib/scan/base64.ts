/**
 * Base64 → bytes without assuming a global atob or Buffer (Hermes on native,
 * plain browsers on web). Pure so it unit-tests in Node.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) table[ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/** Decodes standard base64; whitespace and padding are tolerated. */
export function base64ToBytes(base64: string): Uint8Array {
  const len = base64.length;
  const out = new Uint8Array(Math.ceil((len * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let n = 0;
  for (let i = 0; i < len; i++) {
    const code = base64.charCodeAt(i);
    if (code === 61 /* '=' */) break;
    const value = code < 128 ? (LOOKUP[code] ?? -1) : -1;
    if (value < 0) continue; // skip whitespace/newlines
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[n++] = (buffer >> bits) & 0xff;
    }
  }
  return out.subarray(0, n);
}
