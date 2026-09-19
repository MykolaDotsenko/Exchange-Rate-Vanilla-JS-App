import test from "node:test";
import assert from "node:assert/strict";

import { fetchCurrencies, fetchRate } from "../src/rate-client.js";

function response(payload, { ok = true, status = 200 } = {}) {
  return {
    ok,
    status,
    async json() {
      return payload;
    },
  };
}

test("rate client validates and normalizes a successful pair response", async () => {
  const fetchImpl = async (url, options) => {
    assert.equal(url, "https://example.test/rate/EUR/USD");
    assert.equal(options.headers.Accept, "application/json");

    return response({
      date: "2026-09-18",
      base: "EUR",
      quote: "USD",
      rate: 1.17345,
    });
  };

  assert.deepEqual(
    await fetchRate("EUR", "USD", {
      fetchImpl,
      apiBase: "https://example.test",
    }),
    {
      rate: 1.17345,
      date: "2026-09-18",
    }
  );
});

test("rate client rejects HTTP and payload failures", async () => {
  await assert.rejects(
    () =>
      fetchRate("EUR", "USD", {
        fetchImpl: async () => response({}, { ok: false, status: 503 }),
        apiBase: "https://example.test",
      }),
    /HTTP 503/
  );

  await assert.rejects(
    () =>
      fetchRate("EUR", "USD", {
        fetchImpl: async () =>
          response({
            date: "2026-09-18",
            base: "EUR",
            quote: "GBP",
            rate: 1.17,
          }),
        apiBase: "https://example.test",
      }),
    /unexpected response/
  );
});

test("currency client returns a normalized currency list", async () => {
  const currencies = await fetchCurrencies({
    fetchImpl: async () =>
      response([
        { iso_code: "usd", name: "US Dollar" },
        { iso_code: "eur", name: "Euro" },
      ]),
    apiBase: "https://example.test",
  });

  assert.deepEqual(currencies, [
    { code: "EUR", name: "Euro" },
    { code: "USD", name: "US Dollar" },
  ]);
});

test("currency client rejects unusable metadata", async () => {
  await assert.rejects(
    () =>
      fetchCurrencies({
        fetchImpl: async () => response([{ iso_code: "EUR", name: "Euro" }]),
        apiBase: "https://example.test",
      }),
    /invalid currency list/
  );
});
