# NordRate architecture

NordRate deliberately remains a static browser application.

The product problem is small: request a reference rate, convert an amount, expose the rate date, and fail safely when the network is unavailable. A framework, backend, state library, router, or component system would add maintenance surface without solving a real requirement.

## Dependency direction

~~~text
index.html + style.css
        |
        v
    script.js
browser orchestration
     /         \
    v           v
rate-client   rate-cache
     \         /
      v       v
     exchange.js
  pure domain helpers
~~~

The dependency direction keeps domain rules independent from browser, network, and persistence concerns.

## Runtime responsibilities

### HTML

index.html owns:

- semantic landmarks and heading hierarchy
- native controls
- accessible names and descriptions
- narrowly scoped live regions
- no-JavaScript fallback messaging
- rate-source and reference-rate disclosure
- canonical/social metadata

### CSS

style.css owns:

- design tokens
- fluid responsive layout
- keyboard focus states
- reduced-motion behavior
- forced-colors behavior
- visual hierarchy and progressive enhancement

No visual effect is required for conversion behavior.

### Browser orchestration

script.js owns:

- DOM discovery
- interaction state
- event binding
- request lifecycle
- request cancellation
- rate and metadata timeouts
- UI rendering
- focus behavior
- clipboard enhancement

It composes the domain, API, and storage boundaries but does not contain the exchange-rate HTTP contract or cache implementation.

### Exchange domain

src/exchange.js owns:

- amount parsing
- conversion math
- reciprocal rates
- display formatting
- API-payload validation
- currency metadata normalization

It has no DOM, Fetch API, localStorage, or framework dependency.

### Rate API boundary

src/rate-client.js owns:

- the Frankfurter v2 base URL
- JSON request headers
- HTTP-status handling
- response validation
- conversion of upstream data into the small shape used by the UI

The fetch implementation and API base can be injected, which makes the boundary independently testable without real network access.

### Cache boundary

src/rate-cache.js owns:

- versioned per-pair cache keys
- serialization
- seven-day maximum age
- corruption handling
- invalid-rate rejection
- invalid-date rejection
- future-timestamp rejection

Storage and the clock are injected, so cache semantics can be unit-tested deterministically.

## State model

There is one small in-memory UI state object:

~~~text
base currency
quote currency
current rate
rate date
active amount input
active rate request
last valid conversion
~~~

Derived display values are recalculated rather than stored as independent state.

## Bidirectional conversion

Both amount fields are editable.

When the source amount is authoritative:

~~~text
quote = source × rate
~~~

When the target amount is authoritative:

~~~text
base = target × (1 / rate)
~~~

Programmatic updates modify only the opposite field, so conversion does not create feedback loops.

## Network model

Rates come from Frankfurter v2:

~~~text
GET /v2/rate/{base}/{quote}
GET /v2/currencies
~~~

### Pair requests

A pair request:

1. aborts the obsolete request;
2. renders a valid saved rate immediately when available;
3. starts a fresh request;
4. aborts after eight seconds;
5. verifies that the response still belongs to the selected pair;
6. validates the upstream payload;
7. replaces the saved result only after success.

This protects the UI from stale-response races.

### Currency metadata

Currency metadata is an enhancement, not a prerequisite for conversion.

The HTML contains a useful fallback currency list. Metadata hydration has its own four-second AbortController timeout. If it fails, the server-rendered fallback remains usable.

## Cache semantics

The last successful pair rate is stored with:

- base/quote pair encoded in the key
- rate
- reference date
- local save timestamp

Cached values older than seven days are rejected.

Cache data is never presented as fresh after a refresh failure. The UI explicitly changes its status to **Saved rate** and explains which reference date is being used.

## Money and precision

NordRate is an informational reference converter, not a payment, accounting, or ledger system.

JavaScript Number is proportional to this product because:

- balances are not persisted;
- no transaction is executed;
- the product is display-oriented;
- the upstream JSON API supplies numeric reference rates;
- presentation precision is bounded explicitly.

If the product expanded into settlement, payments, invoicing, or accounting, decimal arithmetic and explicit ISO-4217 minor-unit rules would become domain requirements.

## Accessibility model

The interaction model relies primarily on semantic HTML and native controls.

Implemented protections include:

- skip navigation
- persistent visible focus
- accessible labels
- focused polite status announcements
- alert semantics for network errors
- no color-only status meaning
- touch-friendly targets
- reduced-motion support
- forced-colors support
- responsive text/layout
- no hover-only functionality

Automated axe checks exercise the normal result, invalid-input, and network-error states.

## Visual system

The design is intentionally Nordic rather than decorative-for-decoration's-sake.

The interface uses:

- snow/off-white surfaces
- graphite text
- restrained pine and fjord accents
- large editorial typography
- generous negative space
- subtle translucent depth
- a dark high-contrast result surface
- restrained motion
- no external font, icon, animation, or UI dependency

The generated portfolio screenshots come from the same deterministic Chromium environment used by browser verification.

## Verification architecture

Quality is split into three independent CI jobs.

### Static + unit

~~~text
syntax validation
static project invariants
exchange-domain tests
API-boundary tests
cache-boundary tests
~~~

### Browser + accessibility

Playwright runs deterministic API fixtures across:

~~~text
Chromium
Firefox
WebKit
mobile Chromium
~~~

The suite checks:

- normal conversion
- bidirectional editing
- swap behavior
- quick pairs
- same-currency handling
- invalid-input recovery
- upstream failure
- saved-rate fallback
- obsolete-request race protection
- page overflow

Chromium additionally runs axe WCAG A/AA scans of meaningful UI states.

### Lighthouse

Three desktop passes enforce category floors:

~~~text
Performance      >= 95
Accessibility    = 100
Best Practices   >= 95
SEO              = 100
~~~

This means design quality, accessibility, and performance are executable constraints rather than README claims.

## Reproducibility

Verification dependencies are development-only and pinned through package-lock.json.

CI uses npm ci rather than resolving a new dependency graph on each run.

Browser traces, screenshots, videos, and HTML reports are uploaded as short-lived evidence when the browser job runs.

## SEO and public presentation

The static product includes:

- canonical URL
- Open Graph metadata
- Twitter summary-card metadata
- real 1200 × 630 social preview
- robots.txt
- sitemap.xml
- SVG favicon
- browser-generated desktop/mobile README screenshots

These presentation assets are treated as repository artifacts rather than external dependencies.

## Trade-offs

### Why no historical chart?

A chart would become useful if NordRate expanded into rate-history analysis. For the current fast-conversion task, it adds network requests, visual density, and implementation surface without improving the primary workflow.

### Why no flags?

Currencies do not map one-to-one to countries. Flags introduce ambiguous semantics for currencies used by multiple jurisdictions and for non-country instruments.

### Why no framework?

There is one page, a small state model, and a handful of interactions. Native platform APIs keep dependency cost and runtime surface low while making engineering decisions visible.

### Why keep a cache at all?

A small last-known-rate cache preserves useful behavior during a temporary upstream/network problem. Its age and provenance are explicit, so resilience does not come at the cost of misleading freshness.

## Governing principle

> Add a boundary only when it protects concrete behavior.

NordRate uses architecture for race safety, data validation, persistence resilience, accessibility, and verification. It avoids architectural ceremony where the browser platform already solves the problem well.
