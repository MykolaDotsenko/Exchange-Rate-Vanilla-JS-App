export const DEFAULT_RATES = {
  "EUR/USD": 1.17345,
  "USD/EUR": 0.85219,
  "EUR/SEK": 10.95,
  "EUR/NOK": 11.62,
  "EUR/UAH": 48.65,
};

const CURRENCIES = [
  { iso_code: "EUR", name: "Euro" },
  { iso_code: "USD", name: "US Dollar" },
  { iso_code: "SEK", name: "Swedish Krona" },
  { iso_code: "NOK", name: "Norwegian Krone" },
  { iso_code: "UAH", name: "Ukrainian Hryvnia" },
  { iso_code: "GBP", name: "British Pound" },
];

export async function mockFrankfurter(
  page,
  { rates = DEFAULT_RATES, rateHandler } = {}
) {
  await page.route(
    "https://api.frankfurter.dev/v2/currencies",
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(CURRENCIES),
      });
    }
  );

  await page.route("https://api.frankfurter.dev/v2/rate/**", async (route) => {
    const url = new URL(route.request().url());
    const parts = url.pathname.split("/");
    const base = parts.at(-2);
    const quote = parts.at(-1);

    if (rateHandler) {
      await rateHandler({ route, base, quote });
      return;
    }

    const rate = rates[base + "/" + quote];

    if (!rate) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Pair not mocked" }),
      });
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
}

export async function waitForReferenceRate(page) {
  await page
    .getByText("Reference rate", { exact: true })
    .waitFor({ state: "visible" });
}
