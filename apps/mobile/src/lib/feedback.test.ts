import { describe, expect, it } from "vitest";

import {
  FEEDBACK_TOPICS,
  MAX_FEEDBACK_LENGTH,
  MIN_FEEDBACK_LENGTH,
  composeFeedback,
  feedbackTopicLabel,
  validateFeedback,
} from "./feedback";

const VALID = "The scan screen freezes when I rotate my phone mid-capture.";

describe("validateFeedback", () => {
  it("accepts a message of reasonable length", () => {
    const result = validateFeedback(VALID);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.message).toBe(VALID);
  });

  it("trims surrounding whitespace off the accepted message", () => {
    const result = validateFeedback(`   ${VALID}   `);
    expect(result.valid).toBe(true);
    if (result.valid) expect(result.message).toBe(VALID);
  });

  it("rejects an empty message with an actionable reason", () => {
    const result = validateFeedback("");
    expect(result).toMatchObject({ valid: false, reason: "empty" });
    if (!result.valid) expect(result.error).not.toBe("");
  });

  it("treats whitespace-only input as empty, not as length", () => {
    // "        " is eight characters but zero information.
    expect(validateFeedback("        ")).toMatchObject({ reason: "empty" });
  });

  it("rejects a message below the minimum and says how much is missing", () => {
    const result = validateFeedback("Broken");
    expect(result).toMatchObject({ valid: false, reason: "too-short" });
    if (!result.valid) {
      expect(result.error).toContain(String(MIN_FEEDBACK_LENGTH - "Broken".length));
    }
  });

  it("accepts exactly the minimum length", () => {
    expect(validateFeedback("a".repeat(MIN_FEEDBACK_LENGTH)).valid).toBe(true);
  });

  it("rejects one character below the minimum", () => {
    expect(validateFeedback("a".repeat(MIN_FEEDBACK_LENGTH - 1)).valid).toBe(false);
  });

  it("accepts exactly the maximum length", () => {
    expect(validateFeedback("a".repeat(MAX_FEEDBACK_LENGTH)).valid).toBe(true);
  });

  it("rejects one character above the maximum and says by how much", () => {
    const result = validateFeedback("a".repeat(MAX_FEEDBACK_LENGTH + 1));
    expect(result).toMatchObject({ valid: false, reason: "too-long" });
    if (!result.valid) expect(result.error).toContain("1 character");
  });
});

describe("composeFeedback", () => {
  it("puts the topic in the subject so mail can be triaged", () => {
    const draft = composeFeedback({
      topic: "bug",
      message: VALID,
      includeDiagnostics: false,
    });
    expect(draft.subject).toBe("Pore feedback: Something is broken");
    expect(draft.body).toBe(VALID);
  });

  it("appends diagnostics below a separator the sender can delete", () => {
    const draft = composeFeedback({
      topic: "idea",
      message: VALID,
      includeDiagnostics: true,
      diagnostics: {
        appVersion: "1.0.0",
        platform: "ios",
        osVersion: "18.2",
        locale: "en-CA",
      },
    });
    expect(draft.body).toContain(VALID);
    expect(draft.body).toContain("---");
    expect(draft.body).toContain("App version: 1.0.0");
    expect(draft.body).toContain("Platform: ios 18.2");
    expect(draft.body).toContain("Locale: en-CA");
  });

  it("omits diagnostics entirely when the sender opted out", () => {
    const draft = composeFeedback({
      topic: "idea",
      message: VALID,
      includeDiagnostics: false,
      diagnostics: { appVersion: "1.0.0", platform: "ios" },
    });
    expect(draft.body).toBe(VALID);
    expect(draft.body).not.toContain("App version");
  });

  it("omits diagnostics when opted in but none could be gathered", () => {
    const draft = composeFeedback({
      topic: "other",
      message: VALID,
      includeDiagnostics: true,
    });
    expect(draft.body).toBe(VALID);
  });

  it("never carries photos, email, or skin notes into the diagnostics block", () => {
    const draft = composeFeedback({
      topic: "bug",
      message: VALID,
      includeDiagnostics: true,
      diagnostics: { appVersion: "1.0.0", platform: "android" },
    });
    const block = draft.body!.split("---")[1] ?? "";
    expect(block).not.toMatch(/@/);
    expect(block).not.toMatch(/file:|content:|\.jpg|\.png|base64/i);
  });
});

describe("feedbackTopicLabel", () => {
  it("labels every declared topic", () => {
    for (const topic of FEEDBACK_TOPICS) {
      expect(feedbackTopicLabel(topic.id)).toBe(topic.label);
    }
  });

  it("uses unique topic ids and labels", () => {
    const ids = FEEDBACK_TOPICS.map((t) => t.id);
    const labels = FEEDBACK_TOPICS.map((t) => t.label);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
