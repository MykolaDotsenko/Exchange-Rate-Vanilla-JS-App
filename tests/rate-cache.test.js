import test from "node:test";
import assert from "node:assert/strict";

import { createRateCache } from "../src/rate-cache.js";

function createMemoryStorage() {
  const values = new Map();

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    has(key) {
      return values.has(key);
    },
  };
}

test("rate cache round-trips a valid pair", () => {
  const storage = createMemoryStorage();
  const cache = createRateCache({
    storage,
    now: () => 2_000,
    maxAgeMs: 1_000,
  });

  assert.equal(cache.write("EUR", "USD", 1.17, "2026-09-18"), true);
  assert.deepEqual(cache.read("EUR", "USD"), {
    rate: 1.17,
    date: "2026-09-18",
  });
});

test("rate cache rejects expired entries and removes them", () => {
  const storage = createMemoryStorage();
  storage.setItem(
    "nordrate:rate:v1:EUR:USD",
    JSON.stringify({
      rate: 1.17,
      date: "2026-09-18",
      savedAt: 500,
    })
  );

  const cache = createRateCache({
    storage,
    now: () => 2_000,
    maxAgeMs: 1_000,
  });

  assert.equal(cache.read("EUR", "USD"), null);
  assert.equal(storage.has("nordrate:rate:v1:EUR:USD"), false);
});

test("rate cache rejects corrupted, invalid, and future-dated entries", () => {
  const storage = createMemoryStorage();
  const cache = createRateCache({
    storage,
    now: () => 10_000,
    maxAgeMs: 10_000,
  });

  storage.setItem("nordrate:rate:v1:EUR:USD", "{bad json");
  assert.equal(cache.read("EUR", "USD"), null);

  storage.setItem(
    "nordrate:rate:v1:EUR:USD",
    JSON.stringify({
      rate: -1,
      date: "not-a-date",
      savedAt: 10_000,
    })
  );
  assert.equal(cache.read("EUR", "USD"), null);

  storage.setItem(
    "nordrate:rate:v1:EUR:USD",
    JSON.stringify({
      rate: 1.17,
      date: "2026-09-18",
      savedAt: 80_001,
    })
  );
  assert.equal(cache.read("EUR", "USD"), null);
});

test("rate cache degrades safely when storage is unavailable", () => {
  const cache = createRateCache({ storage: null });

  assert.equal(cache.read("EUR", "USD"), null);
  assert.equal(cache.write("EUR", "USD", 1.17, "2026-09-18"), false);
});
