import { test, expect } from "vitest";
import {
  getSafeServerFetchUrl,
  isLocalHostname,
  normalizeHostForIpCheck
} from "./serverUrlSecurity.js";

test("normalizeHostForIpCheck trims, lowercases, and removes ipv6 brackets", () => {
  expect(normalizeHostForIpCheck(" [::1] ")).toBe("::1");
  expect(normalizeHostForIpCheck("Example.COM")).toBe("example.com");
});

test("isLocalHostname accepts localhost and subdomains only", () => {
  expect(isLocalHostname("localhost")).toBe(true);
  expect(isLocalHostname("api.localhost")).toBe(true);
  expect(isLocalHostname("example.com")).toBe(false);
});

test("getSafeServerFetchUrl rejects localhost hosts and literal ip hosts", () => {
  expect(getSafeServerFetchUrl("http://localhost:3000/image.jpg")).toBe("");
  expect(getSafeServerFetchUrl("https://api.localhost/image.jpg")).toBe("");
  expect(getSafeServerFetchUrl("http://127.0.0.1/image.jpg")).toBe("");
  expect(getSafeServerFetchUrl("https://[::1]/image.jpg")).toBe("");
});

test("getSafeServerFetchUrl keeps valid external http and https urls", () => {
  expect(getSafeServerFetchUrl("https://example.com/image.jpg")).toBe("https://example.com/image.jpg");
  expect(getSafeServerFetchUrl("http://cdn.example.com/path?q=1")).toBe("http://cdn.example.com/path?q=1");
  expect(getSafeServerFetchUrl("ftp://example.com/image.jpg")).toBe("");
});
