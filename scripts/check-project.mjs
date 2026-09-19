import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [html, css, script] = await Promise.all([
  readFile(new URL("../index.html", import.meta.url), "utf8"),
  readFile(new URL("../style.css", import.meta.url), "utf8"),
  readFile(new URL("../script.js", import.meta.url), "utf8"),
]);

function count(source, pattern) {
  return [...source.matchAll(pattern)].length;
}

assert.equal(count(html, /<main\b/gi), 1, "index.html must contain exactly one main");
assert.equal(count(html, /<h1\b/gi), 1, "index.html must contain exactly one h1");
assert.match(html, /<html\s+lang="en"/i, "document language must be declared");
assert.match(html, /name="viewport"/i, "viewport metadata is required");
assert.match(html, /name="description"/i, "description metadata is required");
assert.match(html, /class="skip-link"/i, "skip navigation is required");
assert.match(html, /aria-live="polite"/i, "live status feedback is required");
assert.match(html, /type="module"\s+src="script\.js"/i, "JavaScript must load as a module");
assert.doesNotMatch(
  html,
  /https?:\/\/(?!frankfurter\.dev)/i,
  "runtime HTML should not depend on third-party assets"
);

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
  /api\.frankfurter\.dev\/v2/,
  "the app must use the versioned Frankfurter v2 API"
);
assert.match(script, /AbortController/, "obsolete rate requests must be cancellable");
assert.match(script, /localStorage/, "last successful rates should support offline fallback");

console.log("Static project invariants passed.");
