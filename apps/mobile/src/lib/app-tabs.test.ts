import { describe, expect, it } from "vitest";

import { APP_TABS, APP_TAB_ORDER } from "./app-tabs";

describe("primary app tabs", () => {
  it("keeps Scan centered and Profile at bottom-right", () => {
    expect(APP_TAB_ORDER).toEqual([
      "index",
      "progress",
      "scan",
      "routine",
      "profile",
    ]);
    expect(APP_TABS[2].title).toBe("Scan");
    expect(APP_TABS.at(-1)?.title).toBe("Profile");
  });

  it("uses unique routes and labels", () => {
    expect(new Set(APP_TABS.map((tab) => tab.name)).size).toBe(APP_TABS.length);
    expect(new Set(APP_TABS.map((tab) => tab.title)).size).toBe(APP_TABS.length);
  });
});

