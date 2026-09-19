export const DEFAULT_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_CACHE_PREFIX = "nordrate:rate:v1:";

function keyFor(prefix, base, quote) {
  return prefix + base + ":" + quote;
}

export function createRateCache({
  storage,
  now = () => Date.now(),
  maxAgeMs = DEFAULT_CACHE_MAX_AGE_MS,
  prefix = DEFAULT_CACHE_PREFIX,
} = {}) {
  function read(base, quote) {
    if (!storage) {
      return null;
    }

    const key = keyFor(prefix, base, quote);

    try {
      const raw = storage.getItem(key);

      if (!raw) {
        return null;
      }

      const cached = JSON.parse(raw);
      const savedAt = Number(cached.savedAt);
      const rate = Number(cached.rate);

      if (
        !Number.isFinite(savedAt) ||
        now() - savedAt > maxAgeMs ||
        savedAt - now() > 60_000 ||
        !Number.isFinite(rate) ||
        rate <= 0 ||
        typeof cached.date !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(cached.date)
      ) {
        storage.removeItem(key);
        return null;
      }

      return { rate, date: cached.date };
    } catch {
      return null;
    }
  }

  function write(base, quote, rate, date) {
    if (
      !storage ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      typeof date !== "string"
    ) {
      return false;
    }

    try {
      storage.setItem(
        keyFor(prefix, base, quote),
        JSON.stringify({
          rate,
          date,
          savedAt: now(),
        })
      );
      return true;
    } catch {
      return false;
    }
  }

  return { read, write };
}
