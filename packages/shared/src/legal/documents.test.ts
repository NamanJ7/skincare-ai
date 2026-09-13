import { describe, expect, it } from "vitest";

import { LEGAL_CONFIG, isPending, legalValue, pendingLegalValues } from "./config";
import { LEGAL_DOCUMENTS, PRIVACY_NOTICE, TERMS_OF_USE } from "./index";
import { formatLegalDate, type LegalDocument } from "./types";

const DOCUMENTS = Object.values(LEGAL_DOCUMENTS);

/**
 * Sections a production Terms / Privacy document cannot ship without. The list
 * is the point of the test: deleting a section to "simplify" the copy should
 * fail here rather than quietly removing, say, the liability limit.
 */
const REQUIRED_SECTIONS: Record<LegalDocument["id"], string[]> = {
  terms: [
    "acceptance",
    "eligibility",
    "service",
    "cosmetic-only",
    "accounts",
    "your-content",
    "acceptable-use",
    "availability",
    "purchases",
    "intellectual-property",
    "third-parties",
    "privacy",
    "disclaimers",
    "liability",
    "indemnity",
    "termination",
    "changes",
    "governing-law",
    "contact",
  ],
  privacy: [
    "youth",
    "collect-provided",
    "collect-automatic",
    "on-device",
    "use",
    "processors",
    "analytics",
    "storage",
    "retention",
    "rights",
    "changes",
    "contact",
  ],
};

describe.each(DOCUMENTS)("$title", (doc) => {
  it("has a title, lede, and intro", () => {
    expect(doc.title.trim()).not.toBe("");
    expect(doc.lede.trim()).not.toBe("");
    expect(doc.intro.length).toBeGreaterThan(0);
    for (const paragraph of doc.intro) expect(paragraph.trim()).not.toBe("");
  });

  it("carries ISO dates with effectiveDate no later than lastUpdated", () => {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    expect(doc.effectiveDate).toMatch(iso);
    expect(doc.lastUpdated).toMatch(iso);
    expect(Date.parse(doc.effectiveDate)).toBeLessThanOrEqual(
      Date.parse(doc.lastUpdated),
    );
  });

  it("includes every required section", () => {
    const ids = doc.sections.map((section) => section.id);
    for (const required of REQUIRED_SECTIONS[doc.id]) {
      expect(ids).toContain(required);
    }
  });

  it("uses unique section ids", () => {
    const ids = doc.sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has no empty heading, paragraph, or bullet", () => {
    for (const section of doc.sections) {
      expect(section.heading.trim()).not.toBe("");
      expect(section.body.length).toBeGreaterThan(0);
      for (const paragraph of section.body) expect(paragraph.trim()).not.toBe("");
      for (const bullet of section.bullets ?? []) expect(bullet.trim()).not.toBe("");
    }
  });

  it("leaks no developer placeholder markers into user-facing copy", () => {
    // `[To be completed before launch: …]` is deliberate and checked separately.
    const forbidden = /\b(TODO|FIXME|TBD|Lorem ipsum|XXX)\b/;
    const text = [
      doc.title,
      doc.lede,
      ...doc.intro,
      ...doc.sections.flatMap((s) => [s.heading, ...s.body, ...(s.bullets ?? [])]),
    ].join("\n");
    expect(text).not.toMatch(forbidden);
  });
});

describe("legal config", () => {
  it("keeps the real, verified values as plain strings", () => {
    expect(isPending(LEGAL_CONFIG.supportEmail)).toBe(false);
    expect(LEGAL_CONFIG.supportEmail).toContain("@");
    expect(LEGAL_CONFIG.minimumAge).toBe(13);
  });

  it("declares unknown values as pending rather than leaving them blank", () => {
    const keys = pendingLegalValues().map((entry) => entry.key);
    // If one of these is filled in for real, drop it from this list.
    expect(keys).toEqual([
      "legalEntityName",
      "businessAddress",
      "governingLaw",
      "disputeVenue",
    ]);
    for (const entry of pendingLegalValues()) {
      expect(entry.describe.trim()).not.toBe("");
    }
  });

  it("renders a pending value as a visible launch marker", () => {
    expect(legalValue(LEGAL_CONFIG.legalEntityName)).toMatch(
      /^\[To be completed before launch: .+\]$/,
    );
    expect(legalValue("Acme Inc.")).toBe("Acme Inc.");
  });

  it("never fabricates a company name or jurisdiction in the documents", () => {
    // Pending values must reach the rendered text as markers, not as invented
    // prose. If someone hardcodes "Pore Inc." into a section, this catches it.
    const text = DOCUMENTS.flatMap((doc) =>
      doc.sections.flatMap((s) => s.body),
    ).join("\n");
    expect(text).not.toMatch(/\bPore (Inc|LLC|Ltd|GmbH|Limited|Corp)\b/);
  });
});

describe("cross-document consistency", () => {
  it("uses one canonical name per document", () => {
    expect(TERMS_OF_USE.title).toBe("Terms of Use");
    expect(PRIVACY_NOTICE.title).toBe("Privacy Notice");
  });

  it("points every contact route at the real support address", () => {
    for (const doc of DOCUMENTS) {
      const contact = doc.sections.find((section) => section.id === "contact");
      expect(contact?.body.join(" ")).toContain(LEGAL_CONFIG.supportEmail);
    }
  });

  it("keeps the medical-guidance boundary in the Terms", () => {
    const cosmetic = TERMS_OF_USE.sections.find((s) => s.id === "cosmetic-only");
    expect(cosmetic?.body.join(" ")).toMatch(/not a medical device/i);
  });

  it("states the fail-closed scan promise", () => {
    const availability = TERMS_OF_USE.sections.find((s) => s.id === "availability");
    expect(availability?.body.join(" ")).toMatch(/fabricated/i);
  });
});

describe("formatLegalDate", () => {
  it("renders an ISO date in long form, independent of timezone", () => {
    expect(formatLegalDate("2026-08-26")).toBe("August 26, 2026");
    expect(formatLegalDate("2026-01-01")).toBe("January 1, 2026");
  });

  it("returns the input unchanged when it is not a parseable ISO date", () => {
    expect(formatLegalDate("not-a-date")).toBe("not-a-date");
  });
});
