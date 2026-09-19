import {
  convertAmount,
  formatEditableAmount,
  formatMoney,
  formatRate,
  isValidRatePayload,
  normalizeCurrencyList,
  parseAmount,
  reciprocalRate,
} from "./src/exchange.js";

const API_BASE = "https://api.frankfurter.dev/v2";
const RATE_TIMEOUT_MS = 8000;
const CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const CACHE_PREFIX = "nordrate:rate:v1:";

const fallbackCurrencies = [
  { code: "AUD", name: "Australian Dollar" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "DKK", name: "Danish Krone" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "UAH", name: "Ukrainian Hryvnia" },
  { code: "USD", name: "US Dollar" },
];

const elements = {
  form: document.querySelector("#converter-form"),
  baseCurrency: document.querySelector("#currency-one"),
  quoteCurrency: document.querySelector("#currency-two"),
  baseAmount: document.querySelector("#amount-one"),
  quoteAmount: document.querySelector("#amount-two"),
  swap: document.querySelector("#swap"),
  rate: document.querySelector("#rate"),
  rateDate: document.querySelector("#rate-date"),
  rateStatus: document.querySelector("#rate-status"),
  rateStatusText: document.querySelector("#rate-status-text"),
  resultValue: document.querySelector("#result-value"),
  copyResult: document.querySelector("#copy-result"),
  copyLabel: document.querySelector("#copy-label"),
  errorPanel: document.querySelector("#error-panel"),
  errorTitle: document.querySelector("#error-title"),
  errorMessage: document.querySelector("#error-message"),
  retryButton: document.querySelector("#retry-button"),
  pairChips: [...document.querySelectorAll(".pair-chip")],
};

const requiredElements = Object.entries(elements).filter(
  ([key, value]) => key !== "pairChips" && !value
);

if (requiredElements.length > 0) {
  throw new Error(
    "NordRate could not start. Missing UI: " +
      requiredElements.map(([key]) => key).join(", ")
  );
}

const state = {
  base: elements.baseCurrency.value,
  quote: elements.quoteCurrency.value,
  rate: null,
  rateDate: null,
  activeInput: "base",
  rateController: null,
  lastConversion: null,
};

function cacheKey(base, quote) {
  return CACHE_PREFIX + base + ":" + quote;
}

function readCachedRate(base, quote) {
  try {
    const raw = localStorage.getItem(cacheKey(base, quote));

    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw);
    const savedAt = Number(cached.savedAt);
    const rate = Number(cached.rate);

    if (
      !Number.isFinite(savedAt) ||
      Date.now() - savedAt > CACHE_MAX_AGE_MS ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      typeof cached.date !== "string"
    ) {
      localStorage.removeItem(cacheKey(base, quote));
      return null;
    }

    return { rate, date: cached.date };
  } catch {
    return null;
  }
}

function writeCachedRate(base, quote, rate, date) {
  try {
    localStorage.setItem(
      cacheKey(base, quote),
      JSON.stringify({
        rate,
        date,
        savedAt: Date.now(),
      })
    );
  } catch {
    // Conversion remains fully functional when storage is unavailable.
  }
}

function setRateStatus(label, status) {
  elements.rateStatusText.textContent = label;
  elements.rateStatus.dataset.state = status;
}

function formatDate(date) {
  if (!date) {
    return "Same currency";
  }

  const parsed = new Date(date + "T00:00:00Z");

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

function setError({ title, message } = {}) {
  if (!title || !message) {
    elements.errorPanel.hidden = true;
    return;
  }

  elements.errorTitle.textContent = title;
  elements.errorMessage.textContent = message;
  elements.errorPanel.hidden = false;
}

function setInputValidity(input, isValid) {
  if (isValid) {
    input.removeAttribute("aria-invalid");
  } else {
    input.setAttribute("aria-invalid", "true");
  }
}

function renderPairChips() {
  for (const chip of elements.pairChips) {
    const isActive =
      chip.dataset.base === state.base && chip.dataset.quote === state.quote;
    chip.setAttribute("aria-pressed", String(isActive));
  }
}

function renderRateDetails() {
  if (!state.rate) {
    elements.rate.textContent = "Reference rate unavailable";
    elements.rateDate.textContent = "—";
    return;
  }

  const inverse = reciprocalRate(state.rate);

  if (state.base === state.quote) {
    elements.rate.textContent = "1 " + state.base + " = 1 " + state.quote;
    elements.rateDate.textContent = "Same currency";
    return;
  }

  elements.rate.textContent =
    "1 " +
    state.base +
    " = " +
    formatRate(state.rate) +
    " " +
    state.quote +
    " · 1 " +
    state.quote +
    " = " +
    formatRate(inverse) +
    " " +
    state.base;
  elements.rateDate.textContent = formatDate(state.rateDate);
}

function renderConversion() {
  renderRateDetails();
  renderPairChips();

  if (!state.rate) {
    state.lastConversion = null;
    elements.resultValue.textContent = "—";
    elements.copyResult.disabled = true;
    return;
  }

  const sourceInput =
    state.activeInput === "base" ? elements.baseAmount : elements.quoteAmount;
  const sourceValue = parseAmount(sourceInput.value);
  const hasUserValue = sourceInput.value.trim().length > 0;

  if (sourceValue === null) {
    setInputValidity(sourceInput, !hasUserValue);
    state.lastConversion = null;
    elements.resultValue.textContent = hasUserValue ? "Enter a valid amount" : "—";
    elements.copyResult.disabled = true;

    if (state.activeInput === "base") {
      elements.quoteAmount.value = "";
    } else {
      elements.baseAmount.value = "";
    }

    return;
  }

  setInputValidity(sourceInput, true);

  const baseValue =
    state.activeInput === "base"
      ? sourceValue
      : convertAmount(sourceValue, reciprocalRate(state.rate));
  const quoteValue =
    state.activeInput === "base"
      ? convertAmount(sourceValue, state.rate)
      : sourceValue;

  if (baseValue === null || quoteValue === null) {
    state.lastConversion = null;
    elements.resultValue.textContent = "—";
    elements.copyResult.disabled = true;
    return;
  }

  if (state.activeInput === "base") {
    elements.quoteAmount.value = formatEditableAmount(quoteValue);
  } else {
    elements.baseAmount.value = formatEditableAmount(baseValue);
  }

  const outputValue = state.activeInput === "base" ? quoteValue : baseValue;
  const outputCurrency = state.activeInput === "base" ? state.quote : state.base;

  elements.resultValue.textContent = formatMoney(outputValue, outputCurrency);
  elements.copyResult.disabled = false;
  state.lastConversion = { baseValue, quoteValue };
}

async function fetchRate(base, quote, signal) {
  const response = await fetch(
    API_BASE +
      "/rate/" +
      encodeURIComponent(base) +
      "/" +
      encodeURIComponent(quote),
    {
      headers: { Accept: "application/json" },
      signal,
    }
  );

  if (!response.ok) {
    throw new Error("Rate service returned HTTP " + response.status);
  }

  const payload = await response.json();

  if (!isValidRatePayload(payload, base, quote)) {
    throw new Error("Rate service returned an unexpected response");
  }

  return {
    rate: Number(payload.rate),
    date: payload.date,
  };
}

async function requestRate() {
  state.base = elements.baseCurrency.value;
  state.quote = elements.quoteCurrency.value;
  state.rateController?.abort();

  setError();
  renderPairChips();

  if (state.base === state.quote) {
    state.rate = 1;
    state.rateDate = null;
    setRateStatus("Same currency", "success");
    renderConversion();
    return;
  }

  const cached = readCachedRate(state.base, state.quote);

  if (cached) {
    state.rate = cached.rate;
    state.rateDate = cached.date;
    renderConversion();
  } else {
    state.rate = null;
    state.rateDate = null;
    renderConversion();
  }

  setRateStatus("Refreshing rate", "loading");

  const controller = new AbortController();
  state.rateController = controller;
  const timeoutId = window.setTimeout(() => controller.abort(), RATE_TIMEOUT_MS);
  const requestedBase = state.base;
  const requestedQuote = state.quote;

  try {
    const fresh = await fetchRate(requestedBase, requestedQuote, controller.signal);

    if (
      state.rateController !== controller ||
      requestedBase !== elements.baseCurrency.value ||
      requestedQuote !== elements.quoteCurrency.value
    ) {
      return;
    }

    state.rate = fresh.rate;
    state.rateDate = fresh.date;
    writeCachedRate(requestedBase, requestedQuote, fresh.rate, fresh.date);
    setRateStatus("Reference rate", "success");
    setError();
    renderConversion();
  } catch (error) {
    if (controller.signal.aborted && state.rateController !== controller) {
      return;
    }

    if (cached) {
      state.rate = cached.rate;
      state.rateDate = cached.date;
      setRateStatus("Saved rate", "cached");
      setError({
        title: "Fresh rate unavailable",
        message:
          "Showing the last saved reference rate from " +
          formatDate(cached.date) +
          ".",
      });
      renderConversion();
      return;
    }

    state.rate = null;
    state.rateDate = null;
    setRateStatus("Unavailable", "error");
    setError({
      title: "Rate unavailable",
      message:
        "The reference-rate service could not be reached. Check your connection and try again.",
    });
    renderConversion();

    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.error(error);
    }
  } finally {
    window.clearTimeout(timeoutId);

    if (state.rateController === controller) {
      state.rateController = null;
    }
  }
}

function populateCurrencySelect(select, currencies, selectedCode) {
  const fragment = document.createDocumentFragment();

  for (const currency of currencies) {
    const option = document.createElement("option");
    option.value = currency.code;
    option.textContent = currency.code + " · " + currency.name;
    option.selected = currency.code === selectedCode;
    fragment.append(option);
  }

  select.replaceChildren(fragment);
}

async function loadCurrencies() {
  try {
    const response = await fetch(API_BASE + "/currencies", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return;
    }

    const currencies = normalizeCurrencyList(await response.json());

    if (currencies.length < 2) {
      return;
    }

    const requiredCodes = new Set([state.base, state.quote]);
    const merged = [...currencies];

    for (const currency of fallbackCurrencies) {
      if (
        requiredCodes.has(currency.code) &&
        !merged.some((item) => item.code === currency.code)
      ) {
        merged.push(currency);
      }
    }

    merged.sort((a, b) => a.code.localeCompare(b.code));
    populateCurrencySelect(elements.baseCurrency, merged, state.base);
    populateCurrencySelect(elements.quoteCurrency, merged, state.quote);
  } catch {
    // The server-rendered popular-currency list remains usable.
  }
}

function swapCurrencies() {
  const previousBase = state.base;
  const previousQuote = state.quote;
  const previousBaseAmount = elements.baseAmount.value;
  const previousQuoteAmount = elements.quoteAmount.value;
  const previousRate = state.rate;

  elements.baseCurrency.value = previousQuote;
  elements.quoteCurrency.value = previousBase;
  elements.baseAmount.value = previousQuoteAmount || previousBaseAmount;
  elements.quoteAmount.value = previousBaseAmount;
  state.base = previousQuote;
  state.quote = previousBase;
  state.activeInput = "base";

  if (previousRate && previousBase !== previousQuote) {
    state.rate = reciprocalRate(previousRate);
    renderConversion();
  }

  requestRate();
  elements.baseAmount.focus();
  elements.baseAmount.select();
}

function chooseQuickPair(chip) {
  elements.baseCurrency.value = chip.dataset.base;
  elements.quoteCurrency.value = chip.dataset.quote;
  state.base = chip.dataset.base;
  state.quote = chip.dataset.quote;
  state.activeInput = "base";
  requestRate();
  elements.baseAmount.focus();
}

async function copyConversion() {
  if (!state.lastConversion || !navigator.clipboard) {
    return;
  }

  const text =
    formatMoney(state.lastConversion.baseValue, state.base) +
    " = " +
    formatMoney(state.lastConversion.quoteValue, state.quote) +
    " · 1 " +
    state.base +
    " = " +
    formatRate(state.rate) +
    " " +
    state.quote;

  try {
    await navigator.clipboard.writeText(text);
    elements.copyLabel.textContent = "Copied";
    window.setTimeout(() => {
      elements.copyLabel.textContent = "Copy";
    }, 1400);
  } catch {
    elements.copyLabel.textContent = "Unavailable";
    window.setTimeout(() => {
      elements.copyLabel.textContent = "Copy";
    }, 1400);
  }
}

elements.form.addEventListener("submit", (event) => event.preventDefault());

elements.baseAmount.addEventListener("input", () => {
  state.activeInput = "base";
  setInputValidity(elements.quoteAmount, true);
  renderConversion();
});

elements.quoteAmount.addEventListener("input", () => {
  state.activeInput = "quote";
  setInputValidity(elements.baseAmount, true);
  renderConversion();
});

elements.baseCurrency.addEventListener("change", requestRate);
elements.quoteCurrency.addEventListener("change", requestRate);
elements.swap.addEventListener("click", swapCurrencies);
elements.retryButton.addEventListener("click", requestRate);
elements.copyResult.addEventListener("click", copyConversion);

for (const chip of elements.pairChips) {
  chip.addEventListener("click", () => chooseQuickPair(chip));
}

populateCurrencySelect(elements.baseCurrency, fallbackCurrencies, state.base);
populateCurrencySelect(elements.quoteCurrency, fallbackCurrencies, state.quote);
loadCurrencies();
requestRate();
