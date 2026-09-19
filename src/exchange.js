const MAX_AMOUNT = 1e15;

export function parseAmount(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 && value <= MAX_AMOUNT ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const compact = value.trim().replace(/\s+/g, "");

  if (!compact) {
    return null;
  }

  let normalized = compact;
  const commaIndex = compact.lastIndexOf(",");
  const dotIndex = compact.lastIndexOf(".");

  if (commaIndex !== -1 && dotIndex !== -1) {
    normalized =
      commaIndex > dotIndex
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (commaIndex !== -1) {
    normalized = compact.replace(",", ".");
  }

  if (!/^\d+(?:\.\d*)?$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) && parsed >= 0 && parsed <= MAX_AMOUNT ? parsed : null;
}

export function convertAmount(amount, rate) {
  if (
    !Number.isFinite(amount) ||
    amount < 0 ||
    !Number.isFinite(rate) ||
    rate <= 0
  ) {
    return null;
  }

  return amount * rate;
}

export function reciprocalRate(rate) {
  return Number.isFinite(rate) && rate > 0 ? 1 / rate : null;
}

export function formatEditableAmount(value) {
  if (!Number.isFinite(value)) {
    return "";
  }

  if (value === 0) {
    return "0";
  }

  const magnitude = Math.abs(value);
  const maximumFractionDigits =
    magnitude >= 1000 ? 2 : magnitude >= 1 ? 4 : magnitude >= 0.01 ? 6 : 8;

  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits,
  }).format(value);
}

export function formatMoney(value, currency, locale = "en-US") {
  if (!Number.isFinite(value)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "code",
      maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
    }).format(value);
  } catch {
    return (
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: Math.abs(value) < 1 ? 4 : 2,
      }).format(value) +
      " " +
      currency
    );
  }
}

export function formatRate(rate) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return "—";
  }

  const maximumFractionDigits =
    rate >= 1000 ? 2 : rate >= 100 ? 3 : rate >= 1 ? 5 : rate >= 0.01 ? 6 : 8;

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
  }).format(rate);
}

export function normalizeCurrencyList(payload) {
  if (!Array.isArray(payload)) {
    return [];
  }

  const unique = new Map();

  for (const item of payload) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const code = String(item.iso_code || item.code || "").toUpperCase();
    const name = String(item.name || code).trim();

    if (!/^[A-Z]{3}$/.test(code) || !name) {
      continue;
    }

    unique.set(code, { code, name });
  }

  return [...unique.values()].sort((a, b) => a.code.localeCompare(b.code));
}

export function isValidRatePayload(payload, expectedBase, expectedQuote) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      String(payload.base || "").toUpperCase() === expectedBase &&
      String(payload.quote || "").toUpperCase() === expectedQuote &&
      typeof payload.date === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(payload.date) &&
      Number.isFinite(Number(payload.rate)) &&
      Number(payload.rate) > 0
  );
}
