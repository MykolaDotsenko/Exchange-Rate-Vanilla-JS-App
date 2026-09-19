import {
  convertAmount,
  formatEditableAmount,
  formatMoney,
  formatRate,
  parseAmount,
  reciprocalRate,
} from "./src/exchange.js";
import { createRateCache } from "./src/rate-cache.js";
import { fetchCurrencies, fetchRate } from "./src/rate-client.js";

const RATE_TIMEOUT_MS = 8000;
const CURRENCY_TIMEOUT_MS = 4000;

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

const missingElements = Object.entries(elements).filter(
  ([key, value]) => key !== "pairChips" && !value
);

if (missingElements.length > 0) {
  throw new Error(
    "NordRate could not start. Missing UI: " +
      missingElements.map(([key]) => key).join(", ")
  );
}

function resolveStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const rateCache = createRateCache({ storage: resolveStorage() });

const state = {
  base: elements.baseCurrency.value,
  quote: elements.quoteCurrency.value,
  rate: null,
  rateDate: null,
  activeInput: "base",
  rateController: null,
  lastConversion: null,
};

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

  if (state.base === state.quote) {
    elements.rate.textContent = "1 " + state.base + " = 1 " + state.quote;
    elements.rateDate.textContent = "Same currency";
    return;
  }

  const inverse = reciprocalRate(state.rate);

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

  const inverseRate = reciprocalRate(state.rate);
  const baseValue =
    state.activeInput === "base"
      ? sourceValue
      : convertAmount(sourceValue, inverseRate);
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
  elements.copyResult.disabled = !navigator.clipboard?.writeText;
  state.lastConversion = { baseValue, quoteValue };
}

function abortCurrentRateRequest() {
  state.rateController?.abort();
  state.rateController = null;
}

async function requestRate() {
  state.base = elements.baseCurrency.value;
  state.quote = elements.quoteCurrency.value;

  abortCurrentRateRequest();
  setError();
  renderPairChips();

  if (state.base === state.quote) {
    state.rate = 1;
    state.rateDate = null;
    setRateStatus("Same currency", "success");
    renderConversion();
    return;
  }

  const cached = rateCache.read(state.base, state.quote);

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
    const fresh = await fetchRate(requestedBase, requestedQuote, {
      signal: controller.signal,
    });

    if (
      state.rateController !== controller ||
      requestedBase !== elements.baseCurrency.value ||
      requestedQuote !== elements.quoteCurrency.value
    ) {
      return;
    }

    state.rate = fresh.rate;
    state.rateDate = fresh.date;
    rateCache.write(requestedBase, requestedQuote, fresh.rate, fresh.date);
    setRateStatus("Reference rate", "success");
    setError();
    renderConversion();
  } catch (error) {
    const wasSuperseded =
      controller.signal.aborted && state.rateController !== controller;

    if (wasSuperseded) {
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
  const controller = new AbortController();
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    CURRENCY_TIMEOUT_MS
  );

  try {
    const currencies = await fetchCurrencies({ signal: controller.signal });
    const merged = [...currencies];

    for (const currency of fallbackCurrencies) {
      if (!merged.some((item) => item.code === currency.code)) {
        merged.push(currency);
      }
    }

    merged.sort((a, b) => a.code.localeCompare(b.code));
    populateCurrencySelect(elements.baseCurrency, merged, state.base);
    populateCurrencySelect(elements.quoteCurrency, merged, state.quote);
  } catch {
    // The server-rendered popular-currency list remains usable.
  } finally {
    window.clearTimeout(timeoutId);
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
  if (!state.lastConversion || !navigator.clipboard?.writeText) {
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
  } catch {
    elements.copyLabel.textContent = "Unavailable";
  } finally {
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

if (!navigator.clipboard?.writeText) {
  elements.copyResult.disabled = true;
  elements.copyResult.title = "Copy is not available in this browser";
}

loadCurrencies();
requestRate();
