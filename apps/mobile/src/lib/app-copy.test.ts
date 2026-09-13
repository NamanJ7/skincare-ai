import { describe, expect, it } from "vitest";

import { removeEmDashes, sanitizeAppCopy } from "./app-copy";

describe("app copy", () => {
  it("removes Unicode and encoding-corrupted em dashes", () => {
    expect(removeEmDashes(`First thought \u2014 second thought`)).toBe(
      "First thought, second thought",
    );
    expect(
      removeEmDashes(`First thought \u00e2\u20ac\u201d second thought`),
    ).toBe("First thought, second thought");
  });

  it("cleans nested generated copy without mutating the response", () => {
    const source = {
      assessment: { summary: `Clear overall \u2014 keep going.` },
      routine: [{ rationale: `A simple step \u2014 easy to repeat.` }],
    };

    expect(sanitizeAppCopy(source)).toEqual({
      assessment: { summary: "Clear overall, keep going." },
      routine: [{ rationale: "A simple step, easy to repeat." }],
    });
    expect(source.assessment.summary).toContain("\u2014");
  });
});
