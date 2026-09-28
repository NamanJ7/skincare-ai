/**
 * Route integrity for the legal and support destinations.
 *
 * The bug this exists to prevent: `PRIVACY_URL`/`TERMS_URL` pointed at
 * `https://pore.skin/...`, a domain that was never registered, so every legal
 * link in the app — including the two the youth-consent flow asks a parent to
 * read — opened a browser error page. Nothing failed at build time, nothing
 * failed in CI, and the only way to notice was to tap the row.
 *
 * These tests read the real `src/app` tree, so a route constant that stops
 * matching a file fails here instead of at a reader's fingertip.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  LEGAL_ROUTES,
  PRIVACY_ROUTE,
  SUPPORT_EMAIL,
  TERMS_ROUTE,
  WEBSITE_PRIVACY_URL,
  WEBSITE_TERMS_URL,
} from "./legal";

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_DIR = join(SRC, "app");

/** Does `/foo/bar` correspond to a real expo-router file? */
function routeExists(route: string): boolean {
  const segments = route.replace(/^\//, "").split("/").filter(Boolean);
  const base = join(APP_DIR, ...segments);
  return (
    existsSync(`${base}.tsx`) ||
    existsSync(`${base}.ts`) ||
    existsSync(join(base, "index.tsx")) ||
    existsSync(join(base, "index.ts"))
  );
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    if (!/\.tsx?$/.test(entry) || entry.includes(".test.")) return [];
    return [full];
  });
}

describe("legal routes", () => {
  it("resolves every legal route to a real screen file", () => {
    for (const route of LEGAL_ROUTES) {
      expect(routeExists(route), `${route} has no screen file`).toBe(true);
    }
  });

  it("points at the in-app documents, not a website", () => {
    expect(TERMS_ROUTE).toBe("/legal/terms");
    expect(PRIVACY_ROUTE).toBe("/legal/privacy");
    for (const route of LEGAL_ROUTES) {
      expect(route.startsWith("/")).toBe(true);
      expect(route).not.toMatch(/^https?:/);
    }
  });

  it("detects a broken route rather than trusting the constant", () => {
    // Guards the guard: if `routeExists` returned true unconditionally the
    // assertions above would pass against a deleted screen.
    expect(routeExists("/legal/does-not-exist")).toBe(false);
  });
});

describe("no screen opens a legal URL", () => {
  const screens = sourceFiles(APP_DIR).concat(sourceFiles(join(SRC, "components")));

  it("finds screen sources to check", () => {
    expect(screens.length).toBeGreaterThan(10);
  });

  it.each([
    ["pore.skin/terms", /pore\.skin\/terms/],
    ["pore.skin/privacy", /pore\.skin\/privacy/],
  ])("never hardcodes %s in a screen", (_label, pattern) => {
    const offenders = screens.filter((file) =>
      pattern.test(readFileSync(file, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("routes legal navigation through the shared constants", () => {
    // A screen that hardcodes "/legal/terms" bypasses the integrity check
    // above, so keep the constants the single way in.
    const offenders = screens.filter((file) => {
      const source = readFileSync(file, "utf8");
      return /router\.(push|replace)\(\s*["'`]\/legal\//.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("support contact", () => {
  it("exposes a usable support address", () => {
    expect(SUPPORT_EMAIL).toMatch(/^[^@\s]+@[^@\s]+\.[^@\s]+$/);
  });

  it("keeps the public mirrors as https prose references only", () => {
    expect(WEBSITE_TERMS_URL).toMatch(/^https:\/\/.+\/terms$/);
    expect(WEBSITE_PRIVACY_URL).toMatch(/^https:\/\/.+\/privacy$/);
  });
});
