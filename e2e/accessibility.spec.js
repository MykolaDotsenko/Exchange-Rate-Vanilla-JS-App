import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { mockFrankfurter, waitForReferenceRate } from "./helpers/frankfurter.js";

const wcagTags = [
  "wcag2a",
  "wcag2aa",
  "wcag21a",
  "wcag21aa",
  "wcag22aa",
];

async function expectNoA11yViolations(page) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze();

  expect(
    results.violations,
    results.violations
      .map((violation) => violation.id + ": " + violation.help)
      .join("\n")
  ).toEqual([]);
}

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "axe scan runs once in Chromium; interaction coverage runs in every browser"
  );
  await mockFrankfurter(page);
});

test("result state has no WCAG A/AA axe violations", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);
  await expectNoA11yViolations(page);
});

test("invalid-input state has no WCAG A/AA axe violations", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);
  await page.locator("#amount-one").fill("bad");
  await expect(page.locator("#amount-one")).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expectNoA11yViolations(page);
});

test("network-error state has no WCAG A/AA axe violations", async ({ page }) => {
  await page.unroute("https://api.frankfurter.dev/v2/rate/**");
  await page.route("https://api.frankfurter.dev/v2/rate/**", async (route) => {
    await route.fulfill({ status: 503, body: "{}" });
  });

  await page.goto("/");
  await expect(page.getByRole("alert")).toBeVisible();
  await expectNoA11yViolations(page);
});
