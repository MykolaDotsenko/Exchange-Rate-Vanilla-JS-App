# NordRate architecture

NordRate deliberately remains a static browser application.

The product problem is small: request a reference rate, convert an amount, expose the rate date, and fail safely when the network is unavailable. A framework, backend, state library, router, or component system would add maintenance surface without solving a real requirement.

## Dependency direction

~~~text
index.html + style.css
        |
        v
    script.js
 browser / API adapter
        |
        v
 src/exchange.js
 pure exchange helpers
~~~

The pure module has no DOM, network, storage, or framework dependency.

## Runtime responsibilities

### HTML

- semantic landmarks and heading hierarchy
- native form controls
- accessible names and descriptions
- live regions for asynchronous feedback
- no-JavaScript fallback message
- product/source disclosure

### CSS

- design tokens
- fluid responsive layout
- keyboard focus states
- reduced-motion handling
- forced-colors handling
- progressive visual enhancement only

### Browser adapter

script.js owns:

- DOM discovery
- event binding
- Frankfurter API requests
- AbortController cancellation
- request timeout
- localStorage rate fallback
- currency metadata hydration
- copy-to-clipboard behavior
- UI state rendering

### Pure domain helpers

src/exchange.js owns:

- amount parsing
- conversion math
- reciprocal rates
- display formatting
- API boundary validation
- currency metadata normalization

## State model

There is one small in-memory state object:

~~~text
base currency
quote currency
current rate
rate date
active amount input
active rate request
last valid conversion
~~~

Derived display data is calculated on render rather than duplicated as independent state.

## Bidirectional conversion

Both amount fields are editable.

When the user edits the source amount:

~~~text
quote = source × rate
~~~

When the user edits the target amount:

~~~text
base = target × (1 / rate)
~~~

The untouched field is updated programmatically. This avoids feedback loops and makes the direction of user intent explicit.

## Network model

Rates come from Frankfurter v2:

~~~text
GET /v2/rate/{base}/{quote}
GET /v2/currencies
~~~

Every rate response is validated before it reaches the UI.

A new pair selection aborts the obsolete rate request. Requests also time out after eight seconds so the interface cannot remain indefinitely in a loading state.

## Cache semantics

The last successful pair rate is persisted in localStorage with:

- base/quote pair in the key
- reference date
- rate
- local save timestamp

Cached rates are accepted for at most seven days.

The cache is not treated as authoritative. On every pair request NordRate attempts a fresh network lookup. Cache data is used only to:

1. render useful information immediately while refreshing; or
2. preserve a usable result when the rate service is temporarily unreachable.

The UI explicitly changes its status to Saved rate when this fallback is active.

## Money and precision

NordRate is an informational reference converter, not an accounting or payment system.

JavaScript Number is adequate for interactive display conversion here because:

- there is no ledger;
- values are not persisted as balances;
- no transaction is executed;
- the authoritative API itself is consumed as JSON numeric rates.

The UI avoids claiming bank-grade settlement accuracy and exposes a clear reference-rate disclaimer.

If this product were extended into payments or accounting, decimal arithmetic and explicit currency minor-unit rules would become a hard domain requirement.

## Accessibility

The interaction model relies primarily on native controls.

Important behaviors:

- skip navigation
- persistent visible focus
- form labels
- polite asynchronous status announcements
- alert semantics for rate failures
- no color-only status meaning
- touch-friendly targets
- reduced-motion support
- forced-colors support
- responsive text and layout
- no hover-only functionality

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
- very limited motion
- no external font, icon, animation, or UI dependency

The visual effects degrade without affecting conversion behavior.

## Trade-offs

### Why no chart?

A historical chart would be useful only if NordRate grew into a market-history product. For the current fast-conversion job, a chart increases data requests, visual density, and implementation surface without improving the primary task.

### Why no flags?

Currencies do not map one-to-one to countries. Flags would create misleading semantics for EUR, USD, CHF, XDR, precious metals, and currencies used across multiple jurisdictions.

### Why no framework?

There is one page, a small state model, and a handful of interactions. Native platform APIs keep dependency cost at zero and make the core engineering decisions visible.

## Quality gate

The repository uses only Node built-ins for verification:

~~~text
node --check
static project invariants
node:test unit tests
~~~

CI runs the same quality gate on every pull request and push to main.
