import { test, expect } from "vitest";
import {
  getSafeServerFetchUrl,
  isLocalHostname,
  isUnsafeServerFetchAddress,
  normalizeHostForIpCheck,
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
  expect(getSafeServerFetchUrl("https://example.com/image.jpg")).toBe(
    "https://example.com/image.jpg",
  );
  expect(getSafeServerFetchUrl("http://cdn.example.com/path?q=1")).toBe(
    "http://cdn.example.com/path?q=1",
  );
  expect(getSafeServerFetchUrl("ftp://example.com/image.jpg")).toBe("");
});

test("isUnsafeServerFetchAddress rejects private and special network ranges", () => {
  for (const address of [
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "224.0.0.1",
    "::",
    "::1",
    "fc00::1",
    "fd00::1",
    "fe80::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
  ]) {
    expect(isUnsafeServerFetchAddress(address)).toBe(true);
  }

  expect(isUnsafeServerFetchAddress("93.184.216.34")).toBe(false);
  expect(isUnsafeServerFetchAddress("2606:2800:220:1:248:1893:25c8:1946")).toBe(
    false,
  );
});
