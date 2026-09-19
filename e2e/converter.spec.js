import { expect, test } from "@playwright/test";

import {
  DEFAULT_RATES,
  mockFrankfurter,
  waitForReferenceRate,
} from "./helpers/frankfurter.js";

test.beforeEach(async ({ page }) => {
  await mockFrankfurter(page);
});

test("converts the default EUR to USD amount and exposes provenance", async ({
  page,
}) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  await expect(page.getByLabel("Source currency")).toHaveValue("EUR");
  await expect(page.getByLabel("Target currency")).toHaveValue("USD");
  await expect(page.locator("#amount-one")).toHaveValue("100");
  await expect(page.locator("#amount-two")).toHaveValue("117.345");
  await expect(page.locator("#result-value")).toContainText("USD");
  await expect(page.locator("#result-value")).toContainText("117.35");
  await expect(page.locator("#rate")).toContainText(
    "1 EUR = 1.17345 USD"
  );
  await expect(page.locator("#rate-date")).toContainText("Sep 18, 2026");
  await expect(page.getByRole("link", { name: /Frankfurter/ })).toBeVisible();
});

test("supports bidirectional editing without feedback loops", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  await page.locator("#amount-two").fill("200");

  const base = Number(await page.locator("#amount-one").inputValue());
  expect(base).toBeCloseTo(200 / DEFAULT_RATES["EUR/USD"], 3);
  await expect(page.locator("#result-value")).toContainText("EUR");
});

test("swaps currencies while preserving the economic value", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  await page.getByRole("button", { name: /swap source and target/i }).click();
  await waitForReferenceRate(page);

  await expect(page.getByLabel("Source currency")).toHaveValue("USD");
  await expect(page.getByLabel("Target currency")).toHaveValue("EUR");

  const source = Number(await page.locator("#amount-one").inputValue());
  const target = Number(await page.locator("#amount-two").inputValue());

  expect(source).toBeCloseTo(117.345, 3);
  expect(target).toBeCloseTo(source * DEFAULT_RATES["USD/EUR"], 3);
});

test("quick pairs switch the authoritative pair", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  await page.getByRole("button", { name: "EUR / SEK" }).click();
  await waitForReferenceRate(page);

  await expect(page.getByLabel("Source currency")).toHaveValue("EUR");
  await expect(page.getByLabel("Target currency")).toHaveValue("SEK");
  await expect(page.locator("#amount-two")).toHaveValue("1095");
  await expect(page.locator("#rate")).toContainText("SEK");
  await expect(
    page.getByRole("button", { name: "EUR / SEK" })
  ).toHaveAttribute("aria-pressed", "true");
});

test("same-currency conversion is immediate and network-independent", async ({
  page,
}) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  await page.getByLabel("Target currency").selectOption("EUR");

  await expect(page.getByText("Same currency", { exact: true })).toBeVisible();
  await expect(page.locator("#amount-two")).toHaveValue("100");
  await expect(page.locator("#rate")).toHaveText("1 EUR = 1 EUR");
});

test("invalid amount input produces explicit recoverable feedback", async ({
  page,
}) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  const input = page.locator("#amount-one");
  await input.fill("12abc");

  await expect(input).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator("#amount-two")).toHaveValue("");
  await expect(page.locator("#result-value")).toHaveText(
    "Enter a valid amount"
  );

  await input.fill("12,5");
  await expect(input).not.toHaveAttribute("aria-invalid");
  await expect(page.locator("#amount-two")).toHaveValue("14.6681");
});

test("network failure without cache exposes a retryable error state", async ({
  page,
}) => {
  await page.unroute("https://api.frankfurter.dev/v2/rate/**");
  await page.route("https://api.frankfurter.dev/v2/rate/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unavailable" }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Unavailable", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Rate unavailable");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  await expect(page.locator("#result-value")).toHaveText("—");
});

test("network failure falls back to a clearly labelled saved rate", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "nordrate:rate:v1:EUR:USD",
      JSON.stringify({
        rate: 1.2,
        date: "2026-09-17",
        savedAt: Date.now(),
      })
    );
  });

  await page.unroute("https://api.frankfurter.dev/v2/rate/**");
  await page.route("https://api.frankfurter.dev/v2/rate/**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unavailable" }),
    });
  });

  await page.goto("/");

  await expect(page.getByText("Saved rate", { exact: true })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText(
    "Showing the last saved reference rate"
  );
  await expect(page.locator("#amount-two")).toHaveValue("120");
  await expect(page.locator("#rate-date")).toContainText("Sep 17, 2026");
});

test("a slow obsolete response cannot overwrite a newer quick-pair choice", async ({
  page,
}) => {
  await page.unroute("https://api.frankfurter.dev/v2/rate/**");
  await page.route("https://api.frankfurter.dev/v2/rate/**", async (route) => {
    const url = new URL(route.request().url());
    const [base, quote] = url.pathname.split("/").slice(-2);
    const pair = base + "/" + quote;

    if (pair === "EUR/USD") {
      await new Promise((resolve) => setTimeout(resolve, 450));
    }

    const rate = DEFAULT_RATES[pair];

    if (!rate) {
      await route.fulfill({ status: 404, body: "{}" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        date: "2026-09-18",
        base,
        quote,
        rate,
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "EUR / SEK" }).click();
  await waitForReferenceRate(page);
  await expect(page.locator("#rate")).toContainText("SEK");

  await page.waitForTimeout(600);
  await expect(page.getByLabel("Target currency")).toHaveValue("SEK");
  await expect(page.locator("#rate")).toContainText("SEK");
  await expect(page.locator("#rate")).not.toContainText("USD");
});

test("layout never introduces horizontal page overflow", async ({ page }) => {
  await page.goto("/");
  await waitForReferenceRate(page);

  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});
