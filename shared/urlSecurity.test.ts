import { test, expect } from "vitest";
import {
  ALLOWED_HTTP_PROTOCOLS,
  getSafeHttpUrl,
  isSafeHttpUrl,
} from "./urlSecurity.js";

test("getSafeHttpUrl accepts http and https URLs", () => {
  expect(getSafeHttpUrl(" https://example.com/path?q=1 ")).toBe(
    "https://example.com/path?q=1",
  );
  expect(getSafeHttpUrl("http://example.com")).toBe("http://example.com/");
});

test("getSafeHttpUrl rejects empty, malformed, and non-http URLs", () => {
  expect(getSafeHttpUrl("")).toBe("");
  expect(getSafeHttpUrl("not a url")).toBe("");
  expect(getSafeHttpUrl("javascript:alert(1)")).toBe("");
  expect(getSafeHttpUrl("mailto:test@example.com")).toBe("");
});

test("isSafeHttpUrl reports whether a URL can be safely used as http content", () => {
  expect(isSafeHttpUrl("https://example.com/image.jpg")).toBe(true);
  expect(isSafeHttpUrl(null)).toBe(false);
});

test("ALLOWED_HTTP_PROTOCOLS includes only http protocols", () => {
  expect([...ALLOWED_HTTP_PROTOCOLS].sort()).toEqual(["http:", "https:"]);
});
