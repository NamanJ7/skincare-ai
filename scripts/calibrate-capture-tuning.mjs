#!/usr/bin/env node
/**
 * Turn real, on-device manifest.json exports into CAPTURE_TUNING/TONE_PROFILE
 * suggestions and a flash-verification comparison, instead of hand-computing
 * either from raw numbers.
 *
 * This cannot invent the underlying data — it only summarizes real captures.
 * There is no substitute for actually running the app across the full skin
 * tone range on a real device; see TODOS.md. What this removes is the manual
 * arithmetic once that data exists.
 *
 * Usage:
 *   node scripts/calibrate-capture-tuning.mjs <directory-of-pulled-manifests>
 *   node scripts/calibrate-capture-tuning.mjs --self-test
 *
 * The directory can be the `skin-photos` folder copied off a device as-is
 * (one subfolder per session, each with its own manifest.json) — this walks
 * it recursively and only looks at files literally named `manifest.json`.
 * Manifests older than version 3 (before `tone` was recorded) are skipped
 * with a warning, since they can't be grouped by tone band.
 *
 * Output is grouped by (tone, illuminant) so one run covers both jobs:
 *   - CAPTURE_TUNING / TONE_PROFILE calibration (packages/shared/src/vision/quality.ts)
 *   - the flash="screen" verification procedure (compare screen_flash vs
 *     ambient meanLuma for the same tone) documented next to
 *     USE_NATIVE_SCREEN_FLASH in apps/mobile/src/app/onboarding/photo.tsx
 *
 * Suggested numbers are a starting point for a human to review against
 * packages/shared/src/vision/quality.ts and flash.ts, not a value to paste
 * in unread — deliberately not duplicated here, to avoid two copies of the
 * tuning table drifting apart.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";

const MIN_MANIFEST_VERSION = 3;
const METRIC_KEYS = ["meanLuma", "sharpness", "skinCoverage", "chromaDistance", "lightingImbalance", "clippedFraction"];

/** Recursively find every file literally named manifest.json under `dir`. */
function findManifests(dir) {
  const found = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (entry === "manifest.json") found.push(full);
    }
  };
  walk(dir);
  return found;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.floor(p * (sorted.length - 1));
  return sorted[idx];
}

function summarize(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return { n: values.length, mean, p10: percentile(sorted, 0.1), p50: percentile(sorted, 0.5), p90: percentile(sorted, 0.9) };
}

/**
 * The one real piece of logic in this script: turn a list of parsed
 * manifests into per-(tone, illuminant) metric summaries, split into clean
 * (unflagged) vs flagged captures.
 */
export function aggregate(manifests) {
  const groups = new Map(); // key: `${tone}|${illuminant}|${clean}` -> { metric -> number[] }

  for (const manifest of manifests) {
    if (typeof manifest.version !== "number" || manifest.version < MIN_MANIFEST_VERSION) continue;
    const tone = manifest.tone;
    if (!tone) continue;

    for (const photo of manifest.photos ?? []) {
      const illuminant = photo.quality?.illuminant ?? "unknown";
      const clean = (photo.quality?.flags ?? []).length === 0;
      const key = `${tone}|${illuminant}|${clean ? "clean" : "flagged"}`;
      if (!groups.has(key)) {
        groups.set(key, { tone, illuminant, clean, metrics: Object.fromEntries(METRIC_KEYS.map((k) => [k, []])) });
      }
      const group = groups.get(key);
      for (const k of METRIC_KEYS) {
        const v = photo.metrics?.[k];
        if (typeof v === "number") group.metrics[k].push(v);
      }
    }
  }

  return [...groups.values()].map((g) => ({
    tone: g.tone,
    illuminant: g.illuminant,
    clean: g.clean,
    summaries: Object.fromEntries(METRIC_KEYS.map((k) => [k, summarize(g.metrics[k])])),
  }));
}

/**
 * A single suggested minMeanLuma per tone: the 10th percentile of meanLuma
 * across every CLEAN (unflagged) capture at that tone, across illuminants,
 * minus a small safety margin so the floor doesn't sit exactly on the
 * dimmest good shot seen so far. This is a starting point, not an answer —
 * review it against the sample count (n) before trusting it.
 */
export function suggestMinMeanLuma(rows, marginPct = 0.08) {
  const byTone = new Map();
  for (const row of rows) {
    if (!row.clean || !row.summaries.meanLuma) continue;
    const cur = byTone.get(row.tone) ?? { p10s: [], n: 0 };
    cur.p10s.push(row.summaries.meanLuma.p10);
    cur.n += row.summaries.meanLuma.n;
    byTone.set(row.tone, cur);
  }
  const suggestions = {};
  for (const [tone, { p10s, n }] of byTone) {
    const floor = Math.min(...p10s);
    suggestions[tone] = { suggested: Math.round(floor * (1 - marginPct)), sampleFloor: Math.round(floor), n };
  }
  return suggestions;
}

function printReport(rows) {
  console.log(`\n${rows.length} (tone, illuminant, clean) groups found.\n`);
  for (const row of rows.sort((a, b) => a.tone.localeCompare(b.tone) || a.illuminant.localeCompare(b.illuminant))) {
    console.log(`## ${row.tone} · ${row.illuminant} · ${row.clean ? "clean" : "flagged"}`);
    for (const key of METRIC_KEYS) {
      const s = row.summaries[key];
      if (!s) continue;
      console.log(`  ${key.padEnd(16)} n=${s.n.toString().padEnd(4)} mean=${s.mean.toFixed(1).padEnd(8)} p10=${s.p10.toFixed(1).padEnd(8)} p50=${s.p50.toFixed(1).padEnd(8)} p90=${s.p90.toFixed(1)}`);
    }
    console.log("");
  }

  console.log("## Suggested minMeanLuma per tone (review against TONE_PROFILE in quality.ts)\n");
  for (const [tone, s] of Object.entries(suggestMinMeanLuma(rows))) {
    const note = s.n < 20 ? "  ⚠ low sample count, treat as directional only" : "";
    console.log(`  ${tone.padEnd(10)} suggested=${s.suggested}  (dimmest clean sample seen: ${s.sampleFloor}, n=${s.n})${note}`);
  }

  console.log("\n## Flash verification: screen_flash vs ambient meanLuma per tone\n");
  const byTone = new Map();
  for (const row of rows) {
    if (!row.summaries.meanLuma) continue;
    const cur = byTone.get(row.tone) ?? {};
    cur[row.illuminant] = row.summaries.meanLuma.mean;
    byTone.set(row.tone, cur);
  }
  for (const [tone, byIlluminant] of byTone) {
    const flash = byIlluminant.screen_flash;
    const ambient = byIlluminant.ambient;
    if (flash === undefined || ambient === undefined) continue;
    const lift = flash - ambient;
    console.log(`  ${tone.padEnd(10)} screen_flash=${flash.toFixed(1)}  ambient=${ambient.toFixed(1)}  lift=${lift.toFixed(1)}${lift < 5 ? "  ⚠ little to no lift — flash may be a no-op, see TODOS.md" : ""}`);
  }
}

function selfTest() {
  const manifest = (tone, photos) => ({ version: 3, id: "s", capturedAt: "now", tone, photos });
  const photo = (illuminant, flags, meanLuma) => ({
    angle: "front",
    quality: { illuminant, flags },
    metrics: { meanLuma, sharpness: 200, skinCoverage: 0.9, chromaDistance: 5, lightingImbalance: 0.05, clippedFraction: 0.01 },
  });

  const manifests = [
    manifest("deep", [photo("screen_flash", [], 60), photo("ambient", [], 40)]),
    manifest("deep", [photo("screen_flash", [], 64)]),
    manifest("very_fair", [photo("screen_flash", ["dark"], 30)]),
    manifest("very_fair", [photo("screen_flash", [], 100)]),
  ];

  const rows = aggregate(manifests);

  const deepFlashClean = rows.find((r) => r.tone === "deep" && r.illuminant === "screen_flash" && r.clean);
  assert.ok(deepFlashClean, "deep/screen_flash/clean group should exist");
  assert.equal(deepFlashClean.summaries.meanLuma.n, 2);
  assert.equal(deepFlashClean.summaries.meanLuma.mean, 62);

  const fairFlagged = rows.find((r) => r.tone === "very_fair" && !r.clean);
  assert.ok(fairFlagged, "very_fair flagged group should exist");
  assert.equal(fairFlagged.summaries.meanLuma.n, 1);

  const oldManifest = { version: 2, id: "old", photos: [photo("ambient", [], 50)] };
  const rowsWithOld = aggregate([...manifests, oldManifest]);
  assert.equal(rows.length, rowsWithOld.length, "version < 3 manifests must be skipped, not counted");

  const suggestions = suggestMinMeanLuma(rows);
  // deep has two clean groups: screen_flash (n=2, meanLuma 60/64 -> p10=60)
  // and ambient (n=1, meanLuma 40 -> p10=40). The suggestion takes the lower
  // of the two group p10s (40) regardless of illuminant, then applies the
  // margin: 40 * 0.92 = 36.8, rounded to 37. n is the sum across both groups.
  assert.equal(suggestions.deep.suggested, 37);
  assert.equal(suggestions.deep.n, 3);
  // very_fair's only clean group is a single sample at 100 -> p10=100 -> 92.
  assert.equal(suggestions.very_fair.suggested, 92);
  assert.equal(suggestions.very_fair.n, 1);

  console.log("self-test: PASS");
}

const arg = process.argv[2];
if (arg === "--self-test") {
  selfTest();
} else if (!arg) {
  console.error("Usage: node scripts/calibrate-capture-tuning.mjs <directory-of-pulled-manifests>");
  console.error("       node scripts/calibrate-capture-tuning.mjs --self-test");
  process.exit(1);
} else {
  const files = findManifests(arg);
  if (files.length === 0) {
    console.error(`No manifest.json files found under ${arg}`);
    process.exit(1);
  }
  const manifests = [];
  let skipped = 0;
  for (const file of files) {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    if (typeof parsed.version !== "number" || parsed.version < MIN_MANIFEST_VERSION) {
      skipped++;
      continue;
    }
    manifests.push(parsed);
  }
  if (skipped > 0) console.warn(`Skipped ${skipped} manifest(s) older than version ${MIN_MANIFEST_VERSION} (no declared tone).`);
  printReport(aggregate(manifests));
}
