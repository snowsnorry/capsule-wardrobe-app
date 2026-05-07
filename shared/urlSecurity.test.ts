import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_HTTP_PROTOCOLS, getSafeHttpUrl, isSafeHttpUrl } from "./urlSecurity.js";

test("getSafeHttpUrl accepts http and https URLs", () => {
  assert.equal(getSafeHttpUrl(" https://example.com/path?q=1 "), "https://example.com/path?q=1");
  assert.equal(getSafeHttpUrl("http://example.com"), "http://example.com/");
});

test("getSafeHttpUrl rejects empty, malformed, and non-http URLs", () => {
  assert.equal(getSafeHttpUrl(""), "");
  assert.equal(getSafeHttpUrl("not a url"), "");
  assert.equal(getSafeHttpUrl("javascript:alert(1)"), "");
  assert.equal(getSafeHttpUrl("mailto:test@example.com"), "");
});

test("isSafeHttpUrl reports whether a URL can be safely used as http content", () => {
  assert.equal(isSafeHttpUrl("https://example.com/image.jpg"), true);
  assert.equal(isSafeHttpUrl(null), false);
});

test("ALLOWED_HTTP_PROTOCOLS includes only http protocols", () => {
  assert.deepEqual([...ALLOWED_HTTP_PROTOCOLS].sort(), ["http:", "https:"]);
});
