import { expect, test } from "playwright/test";

async function loadFixture(page: import("playwright/test").Page, name: string) {
  await page.goto("/internal/e2e-fixtures");
  await page.getByTestId(`e2e-fixture-${name}`).click();
  await expect(page.getByText(`${name} loaded.`)).toBeVisible();
  await page.goto("/");
}

test("internal mapped routine saves done, skip, and reaction through Progress", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_DISABLED === "1", "Internal fixture journey only");
  await loadFixture(page, "mapped-products");
  await expect(page.getByTestId("daily-loop-start")).toBeVisible();
  await page.getByTestId("daily-loop-start").click();
  await expect(page.getByTestId("daily-loop-done")).toBeVisible();
  await expect(page.getByText("Fictional Gentle Cleanser")).toBeVisible();
  await page.getByTestId("daily-loop-done").click();
  if (await page.getByTestId("daily-loop-skip").isVisible()) {
    await page.getByTestId("daily-loop-skip").click();
    await page.getByTestId("daily-loop-skip-not_now").click();
  }
  while (await page.getByTestId("daily-loop-done").count()) {
    await page.getByTestId("daily-loop-done").click();
  }
  await page.getByTestId("daily-loop-finish").click();
  await page.getByTestId("daily-loop-reaction-comfortable").click();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.goto("/(tabs)/progress");
  await expect(page.getByText(/routine/i).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/routine/i).first()).toBeVisible();
});

test("fresh onboarding reaches mapped guided routine, coaching Apply/Undo, and Progress", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_DISABLED === "1", "Internal fixture journey only");
  await loadFixture(page, "fresh-onboarding");
  await page.goto("/onboarding/age");
  await expect(page.getByText("How old are you?")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /Active breakouts/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Combination/ }).click();
  await page.getByRole("radio", { name: /3-step balanced/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: /Sometimes irritated/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("checkbox", { name: /None of these apply/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Use answers only" }).click();
  await expect(page.getByRole("button", { name: "Start my routine" })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Start my routine" }).click();
  await page.getByRole("button", { name: "Not now" }).click();
  await expect(page).toHaveURL(/routine/);
  await page.reload();
  await expect(page).toHaveURL(/routine/);
  await page.goto("/add-product");
  await page.getByRole("textbox", { name: "Product name" }).fill("Fictional Gentle Cleanser");
  await page.getByRole("button", { name: "Cleanser", exact: true }).click();
  await page.getByRole("button", { name: "Ceramides", exact: true }).click();
  await page.getByRole("button", { name: "Add to shelf" }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("pore/profile")?.includes("Fictional Gentle Cleanser"))).toBe(true);
  await page.goto("/");
  await page.getByTestId("daily-loop-start").click();
  await expect(page.getByText("Fictional Gentle Cleanser")).toBeVisible();
  await page.getByTestId("daily-loop-done").click();
  if (await page.getByTestId("daily-loop-skip").isVisible()) {
    await page.getByTestId("daily-loop-skip").click();
    await page.getByTestId("daily-loop-skip-not_now").click();
  }
  while (await page.getByTestId("daily-loop-done").count()) {
    await page.getByTestId("daily-loop-done").click();
  }
  await page.getByTestId("daily-loop-finish").click();
  await page.getByTestId("daily-loop-reaction-mild_irritation").click();
  await page.getByRole("button", { name: "Back to Home" }).click();
  await expect(page.getByTestId("daily-loop-apply-adjustment").last()).toBeVisible();
  await page.getByTestId("daily-loop-apply-adjustment").last().click();
  await page.getByTestId("daily-loop-undo-adjustment").last().click();
  await page.goto("/(tabs)/progress");
  await expect(page.getByText("Routine adjustment undone")).toBeVisible();
});

test("internal mild reaction suggests Recovery Mode, applies and undoes", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_DISABLED === "1", "Internal fixture journey only");
  await loadFixture(page, "recent-mild-irritation");
  await expect(page.getByTestId("daily-loop-apply-adjustment")).toBeVisible();
  await page.getByTestId("daily-loop-apply-adjustment").click();
  await expect(page.getByTestId("daily-loop-undo-adjustment")).toBeVisible();
  await page.getByTestId("daily-loop-undo-adjustment").click();
  await expect(page.getByTestId("daily-loop-undo-adjustment")).toHaveCount(0);
  await page.goto("/(tabs)/progress");
  await expect(page.getByText("Routine adjustment undone")).toBeVisible();
});

test("two of three scheduled skips offer Minimum Mode and dismiss for today", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_DISABLED === "1", "Internal fixture journey only");
  await loadFixture(page, "repeated-skips");
  await expect(page.getByText("Keep your routine easier to finish")).toBeVisible();
  await page.getByTestId("daily-loop-dismiss-adjustment").click();
  await expect(page.getByText("Keep your routine easier to finish")).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Keep your routine easier to finish")).toHaveCount(0);
});

test("fixture entry redirects without mutation in beta/production build", async ({ page }) => {
  test.skip(process.env.E2E_EXPECT_DISABLED !== "1", "Run against export without fixture flag");
  await page.goto("/");
  await page.evaluate(() => window.localStorage.setItem("pore/profile", "e2e-gate-sentinel"));
  await page.goto("/internal/e2e-fixtures");
  await expect(page.getByTestId("e2e-fixture-mapped-products")).toHaveCount(0);
  await expect(page).not.toHaveURL(/internal\/e2e-fixtures/);
  expect(await page.evaluate(() => window.localStorage.getItem("pore/profile"))).toBe("e2e-gate-sentinel");
});
