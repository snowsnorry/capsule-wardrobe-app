import test from "node:test";
import assert from "node:assert/strict";
import {
  getSafeServerFetchUrl,
  isLocalHostname,
  normalizeHostForIpCheck
} from "./serverUrlSecurity.js";

test("normalizeHostForIpCheck trims, lowercases, and removes ipv6 brackets", () => {
  assert.equal(normalizeHostForIpCheck(" [::1] "), "::1");
  assert.equal(normalizeHostForIpCheck("Example.COM"), "example.com");
});

test("isLocalHostname accepts localhost and subdomains only", () => {
  assert.equal(isLocalHostname("localhost"), true);
  assert.equal(isLocalHostname("api.localhost"), true);
  assert.equal(isLocalHostname("example.com"), false);
});

test("getSafeServerFetchUrl rejects localhost hosts and literal ip hosts", () => {
  assert.equal(getSafeServerFetchUrl("http://localhost:3000/image.jpg"), "");
  assert.equal(getSafeServerFetchUrl("https://api.localhost/image.jpg"), "");
  assert.equal(getSafeServerFetchUrl("http://127.0.0.1/image.jpg"), "");
  assert.equal(getSafeServerFetchUrl("https://[::1]/image.jpg"), "");
});

test("getSafeServerFetchUrl keeps valid external http and https urls", () => {
  assert.equal(getSafeServerFetchUrl("https://example.com/image.jpg"), "https://example.com/image.jpg");
  assert.equal(getSafeServerFetchUrl("http://cdn.example.com/path?q=1"), "http://cdn.example.com/path?q=1");
  assert.equal(getSafeServerFetchUrl("ftp://example.com/image.jpg"), "");
});
