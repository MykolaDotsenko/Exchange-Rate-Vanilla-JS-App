import {
  isValidRatePayload,
  normalizeCurrencyList,
} from "./exchange.js";

export const API_BASE = "https://api.frankfurter.dev/v2";

async function fetchJson(url, { signal, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error("Rate service returned HTTP " + response.status);
  }

  return response.json();
}

export async function fetchRate(
  base,
  quote,
  { signal, fetchImpl = globalThis.fetch, apiBase = API_BASE } = {}
) {
  const payload = await fetchJson(
    apiBase +
      "/rate/" +
      encodeURIComponent(base) +
      "/" +
      encodeURIComponent(quote),
    { signal, fetchImpl }
  );

  if (!isValidRatePayload(payload, base, quote)) {
    throw new Error("Rate service returned an unexpected response");
  }

  return {
    rate: Number(payload.rate),
    date: payload.date,
  };
}

export async function fetchCurrencies({
  signal,
  fetchImpl = globalThis.fetch,
  apiBase = API_BASE,
} = {}) {
  const payload = await fetchJson(apiBase + "/currencies", {
    signal,
    fetchImpl,
  });

  const currencies = normalizeCurrencyList(payload);

  if (currencies.length < 2) {
    throw new Error("Rate service returned an invalid currency list");
  }

  return currencies;
}
