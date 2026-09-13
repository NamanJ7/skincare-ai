/**
 * Link integrity for the site chrome.
 *
 * Every href in the header, footer, and legal row is checked against the real
 * `app/` tree, so a renamed or deleted route fails here rather than rendering a
 * 404 for a reader who trusted the footer.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { FOOTER_NAV, LEGAL_LINKS, NAV_LINKS, SOCIAL_LINKS } from "../nav";

const APP_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../app");

/**
 * Resolve a URL path to a `page.tsx`, ignoring route groups like `(site)`
 * which are organisational and contribute nothing to the URL.
 */
function pageExists(pathname: string): boolean {
  const segments = pathname.replace(/^\//, "").split("/").filter(Boolean);

  const search = (dir: string, remaining: string[]): boolean => {
    if (remaining.length === 0) {
      if (existsSync(join(dir, "page.tsx")) || existsSync(join(dir, "page.ts"))) {
        return true;
      }
      // `/` itself lives at `app/(site)/page.tsx`, so an exhausted path still
      // has to look through route groups before giving up.
    }
    const [head, ...tail] = remaining;
    if (head !== undefined) {
      const direct = join(dir, head);
      if (existsSync(direct) && statSync(direct).isDirectory()) {
        if (search(direct, tail)) return true;
      }
    }
    // Route groups do not consume a segment; dynamic segments do.
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (!statSync(full).isDirectory()) continue;
      if (entry.startsWith("(") && entry.endsWith(")")) {
        if (search(full, remaining)) return true;
      } else if (head !== undefined && entry.startsWith("[") && entry.endsWith("]")) {
        if (search(full, tail)) return true;
      }
    }
    return false;
  };

  return search(APP_DIR, segments);
}

const INTERNAL_LINKS = [
  ...NAV_LINKS,
  ...FOOTER_NAV,
  ...LEGAL_LINKS,
].filter((link) => link.href.startsWith("/"));

describe("internal navigation links", () => {
  it("has links to check", () => {
    expect(INTERNAL_LINKS.length).toBeGreaterThan(5);
  });

  it.each(INTERNAL_LINKS)("$label -> $href resolves to a page", ({ href }) => {
    // Strip a hash target like `/#why-pore`; only the path routes.
    const pathname = href.split("#")[0] || "/";
    expect(pageExists(pathname), `${href} has no page.tsx`).toBe(true);
  });

  it("detects a missing page rather than trusting the resolver", () => {
    expect(pageExists("/definitely-not-a-route")).toBe(false);
  });

  it("resolves the legal pages specifically", () => {
    expect(pageExists("/terms")).toBe(true);
    expect(pageExists("/privacy")).toBe(true);
  });
});

describe("legal link naming", () => {
  it("uses the same document names as the documents themselves", async () => {
    const { PRIVACY_NOTICE, TERMS_OF_USE } = await import("@pore/shared/legal");
    const labels = LEGAL_LINKS.map((link) => link.label);
    // "Privacy Policy" in the footer while every other surface said "Privacy
    // Notice" is exactly the inconsistency this pins.
    expect(labels).toContain(PRIVACY_NOTICE.title);
    expect(labels).toContain(TERMS_OF_USE.title);
  });

  it("points each legal label at its canonical path", () => {
    const byLabel = new Map(LEGAL_LINKS.map((l) => [l.label, l.href]));
    expect(byLabel.get("Privacy Notice")).toBe("/privacy");
    expect(byLabel.get("Terms of Use")).toBe("/terms");
  });
});

describe("external links", () => {
  it.each(SOCIAL_LINKS)("$label uses https", ({ href }) => {
    expect(href.startsWith("https://")).toBe(true);
  });
});
