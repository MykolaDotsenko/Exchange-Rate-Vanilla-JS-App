import test from "node:test";
import assert from "node:assert/strict";

import {
  convertAmount,
  formatEditableAmount,
  formatRate,
  isValidRatePayload,
  normalizeCurrencyList,
  parseAmount,
  reciprocalRate,
} from "../src/exchange.js";

test("parseAmount accepts Nordic decimal comma and common grouping", () => {
  assert.equal(parseAmount("12,5"), 12.5);
  assert.equal(parseAmount("1 234,50"), 1234.5);
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
});

test("parseAmount rejects negative, malformed, and unbounded values", () => {
  assert.equal(parseAmount("-1"), null);
  assert.equal(parseAmount("12abc"), null);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("10000000000000000"), null);
});

test("conversion and reciprocal preserve pair math", () => {
  const rate = 1.17345;
  const converted = convertAmount(100, rate);

  assert.equal(converted, 117.345);
  assert.ok(Math.abs(convertAmount(converted, reciprocalRate(rate)) - 100) < 1e-10);
});

test("conversion rejects invalid rates", () => {
  assert.equal(convertAmount(100, 0), null);
  assert.equal(convertAmount(100, -1), null);
  assert.equal(reciprocalRate(0), null);
});

test("editable formatting stays compact and ungrouped", () => {
  assert.equal(formatEditableAmount(1234.5), "1234.5");
  assert.equal(formatEditableAmount(0), "0");
  assert.equal(formatEditableAmount(Number.NaN), "");
});

test("rate formatting adapts precision to magnitude", () => {
  assert.equal(formatRate(1), "1");
  assert.match(formatRate(0.00873456), /^0\.00873456$/);
  assert.equal(formatRate(1500.1234), "1,500.12");
});

test("currency metadata is normalized, de-duplicated, and sorted", () => {
  assert.deepEqual(
    normalizeCurrencyList([
      { iso_code: "usd", name: "US Dollar" },
      { iso_code: "eur", name: "Euro" },
      { iso_code: "USD", name: "United States Dollar" },
      { iso_code: "INVALID", name: "Ignore" },
      null,
    ]),
    [
      { code: "EUR", name: "Euro" },
      { code: "USD", name: "United States Dollar" },
    ]
  );
});

test("rate payload validation protects the UI boundary", () => {
  assert.equal(
    isValidRatePayload(
      {
        date: "2026-09-19",
        base: "EUR",
        quote: "USD",
        rate: 1.17,
      },
      "EUR",
      "USD"
    ),
    true
  );

  assert.equal(
    isValidRatePayload(
      {
        date: "today",
        base: "EUR",
        quote: "USD",
        rate: 1.17,
      },
      "EUR",
      "USD"
    ),
    false
  );

  assert.equal(
    isValidRatePayload(
      {
        date: "2026-09-19",
        base: "EUR",
        quote: "GBP",
        rate: 1.17,
      },
      "EUR",
      "USD"
    ),
    false
  );
});
