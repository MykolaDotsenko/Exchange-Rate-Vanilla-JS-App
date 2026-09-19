import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const [html, css, script, rateClient, rateCache, readme, sitemap] =
  await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../style.css", import.meta.url), "utf8"),
    readFile(new URL("../script.js", import.meta.url), "utf8"),
    readFile(new URL("../src/rate-client.js", import.meta.url), "utf8"),
    readFile(new URL("../src/rate-cache.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../sitemap.xml", import.meta.url), "utf8"),
  ]);

const PUBLIC_ORIGIN =
  "https://mykoladotsenko.github.io/NordRate/";
const ALLOWED_ORIGINS = new Set([
  "https://mykoladotsenko.github.io",
  "https://frankfurter.dev",
  "https://api.frankfurter.dev",
]);

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

assert.equal(count(html, /<main\b/gi), 1, "index.html must contain exactly one main");
assert.equal(count(html, /<h1\b/gi), 1, "index.html must contain exactly one h1");
assert.match(html, /<html\s+lang="en"/i, "document language must be declared");
assert.match(html, /name="viewport"/i, "viewport metadata is required");
assert.match(html, /name="description"/i, "description metadata is required");
assert.match(html, /rel="canonical"/i, "canonical URL is required");
assert.match(html, /property="og:url"/i, "Open Graph URL is required");
assert.match(html, /property="og:image"/i, "Open Graph image is required");
assert.match(html, /name="twitter:card"/i, "Twitter card metadata is required");
assert.match(html, /class="skip-link"/i, "skip navigation is required");
assert.match(html, /aria-live="polite"/i, "live status feedback is required");
assert.match(
  html,
  /type="module"\s+src="script\.js"/i,
  "JavaScript must load as a module"
);

const absoluteUrls = [...html.matchAll(/https:\/\/[^"'\s<>]+/g)].map(
  ([url]) => url
);

for (const url of absoluteUrls) {
  const parsed = new URL(url);

  assert.ok(
    ALLOWED_ORIGINS.has(parsed.origin),
    "unexpected external URL in runtime HTML: " + url
  );

  if (parsed.origin === "https://mykoladotsenko.github.io") {
    assert.ok(
      url.startsWith(PUBLIC_ORIGIN),
      "public project URL must remain scoped to the NordRate Pages path: " + url
    );
  }
}

assert.match(css, /:focus-visible/, "visible keyboard focus is required");
assert.match(
  css,
  /prefers-reduced-motion:\s*reduce/,
  "reduced-motion support is required"
);
assert.match(css, /forced-colors:\s*active/, "forced-colors support is required");
assert.doesNotMatch(
  css,
  /outline:\s*0\s*;/,
  "focus outlines must not be globally removed"
);

assert.match(
  script,
  /AbortController/,
  "obsolete rate requests and metadata requests must be cancellable"
);
assert.match(
  script,
  /createRateCache/,
  "browser orchestration must use the isolated cache boundary"
);
assert.match(
  rateClient,
  /api\.frankfurter\.dev\/v2/,
  "the API boundary must use the versioned Frankfurter v2 endpoint"
);
assert.match(
  rateCache,
  /nordrate:rate:v1:/,
  "cache entries must remain explicitly versioned"
);

assert.match(
  readme,
  /Open the live app/,
  "README must expose the live product"
);
assert.match(
  readme,
  /docs\/screenshots\/nordrate-desktop\.png/,
  "README must include the real desktop screenshot"
);
assert.match(
  readme,
  /docs\/screenshots\/nordrate-mobile\.png/,
  "README must include the real mobile screenshot"
);
assert.match(
  sitemap,
  /mykoladotsenko\.github\.io\/NordRate/,
  "sitemap must point to the canonical public URL"
);

await Promise.all(
  [
    "../LICENSE",
    "../package-lock.json",
    "../social-preview.png",
    "../docs/screenshots/nordrate-desktop.png",
    "../docs/screenshots/nordrate-mobile.png",
    "../robots.txt",
    "../sitemap.xml",
  ].map((path) => access(new URL(path, import.meta.url)))
);

console.log("Static project invariants passed.");
