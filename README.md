# NordRate — Nordic Currency Converter

A dependency-free currency converter rebuilt from a small Vanilla JavaScript exercise into a polished frontend engineering case study.

NordRate focuses on one job: **convert an amount quickly and make the reference rate easy to trust and understand**.

## Product capabilities

- bidirectional currency conversion — edit either amount
- dynamically loaded current-currency metadata
- quick EUR/USD, EUR/SEK, EUR/NOK, and EUR/UAH pair shortcuts
- source/target currency swap
- visible reference-rate date
- reciprocal rate display
- copyable conversion summary
- cancellable obsolete network requests
- eight-second request timeout
- seven-day last-known-rate fallback through localStorage
- explicit offline/saved-rate state
- input support for both decimal comma and decimal point
- responsive desktop/mobile layout
- reduced-motion and forced-colors support
- zero ads, cookies, analytics, accounts, or tracking

## Stack

### Runtime

- semantic HTML5
- modern CSS
- Vanilla JavaScript
- native ES modules
- Fetch API
- AbortController
- Web Storage API
- Clipboard API
- Intl formatting APIs

### Quality

- Node.js built-in test runner
- Node syntax checks
- zero-dependency static project invariants
- GitHub Actions

There are **zero runtime dependencies and zero npm package dependencies**.

## Data source

NordRate uses the versioned **Frankfurter v2** exchange-rate API:

- no API key
- daily reference exchange-rate data
- currency metadata endpoint
- single-pair rate endpoint
- multiple institutional providers behind the blended reference feed

NordRate displays the rate date because these are reference rates, not live trading quotes.

The interface also makes clear that banks, card networks, cash exchanges, and payment providers can apply their own spreads or fees.

## Architecture

~~~text
semantic HTML + modern CSS
            |
            v
        script.js
   browser / API adapter
            |
            v
     src/exchange.js
      pure helpers
~~~

The exchange module does not know about the DOM, fetch, localStorage, or UI state.

The browser adapter owns network cancellation, caching, events, and rendering.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the detailed design rationale.

## Reliability model

### Race-safe pair changes

Every new currency-pair request aborts the previous request with AbortController.

This prevents a slower old request from overwriting a newer user selection.

### Bounded loading state

Rate requests time out after eight seconds.

The UI therefore cannot remain indefinitely in a fake loading state.

### Last-known-rate fallback

Successful rates are saved per currency pair.

On a later visit NordRate can:

1. render the most recent saved rate immediately;
2. request a fresh reference rate in the background;
3. clearly switch to a Saved rate state if refresh fails.

Cached rates older than seven days are rejected.

### API boundary validation

A network response is accepted only if:

- base currency matches the requested base;
- quote currency matches the requested quote;
- rate is positive and numeric;
- the response includes a valid ISO-style date.

Unexpected responses do not silently enter application state.

## UX and visual direction

The redesign follows a restrained Nordic product language:

- snow/off-white background
- graphite typography
- pine/fjord accent palette
- oversized editorial headline
- generous negative space
- translucent but restrained depth
- high-contrast result surface
- subtle motion instead of decorative animation overload
- mobile-first reflow
- no flag-based currency semantics
- no external fonts or icon libraries

The goal is a premium fintech feel without turning a tiny converter into a dependency-heavy UI demo.

## Accessibility

NordRate includes:

- semantic landmarks
- one clear page heading
- skip navigation
- native select/input/button controls
- visible keyboard focus
- accessible labels
- asynchronous status announcements
- alert semantics for network failures
- touch-friendly controls
- reduced-motion support
- forced-colors support
- responsive text/layout
- no hover-only functionality

## Amount parsing

The input accepts common formats such as:

~~~text
12.5
12,5
1 234,50
1,234.50
1.234,50
~~~

The normalized value is used only for conversion. User-entered values are never sent anywhere except indirectly through the selected currency pair request; the amount itself is not transmitted to the rate API.

## Run locally

Because the application uses native ES modules, serve it over HTTP:

~~~bash
python -m http.server 8000
~~~

Then open:

~~~text
http://localhost:8000
~~~

No package installation is required to run the product.

## Quality checks

Requires Node.js 22+:

~~~bash
npm run check
~~~

The quality gate runs:

1. JavaScript syntax validation
2. static HTML/CSS/project invariants
3. pure exchange-domain unit tests

The same gate runs in GitHub Actions.

## Project structure

~~~text
.
├── .github/
│   └── workflows/
│       └── quality.yml
├── scripts/
│   └── check-project.mjs
├── src/
│   └── exchange.js
├── tests/
│   └── exchange.test.js
├── ARCHITECTURE.md
├── README.md
├── favicon.svg
├── index.html
├── package.json
├── script.js
└── style.css
~~~

## Design principle

> Spend complexity only where it protects user value.

NordRate deliberately does not add React, a router, a state library, a component framework, an animation package, a backend, or a charting library.

For this product scope, the browser platform is enough.
