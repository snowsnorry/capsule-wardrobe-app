import { existsSync } from "node:fs";
import { logInfo } from "./logger.js";

export function formatLogValue(value) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "undefined";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function formatLogPayload(payload = {}) {
  return Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}: ${formatLogValue(value)}`)
    .join(", ");
}

export function logPdfEvent(event, payload = {}) {
  const message = formatLogPayload(payload);

  if (message) {
    logInfo(`[wardrobe-pdf][${event}] ${message}`);
    return;
  }

  logInfo(`[wardrobe-pdf][${event}]`);
}

export function resolveFontPath(candidates) {
  const match = candidates.find((candidate) => existsSync(candidate));
  if (!match) {
    throw new Error(`font_not_found:${candidates[0]}`);
  }
  return match;
}

export function hasNonLatinText(value) {
  return Array.from(String(value || "")).some((char) => {
    const codePoint = char.codePointAt(0) ?? 0;
    return codePoint > 0x024f;
  });
}

export function productNeedsUnicodeFallback(product, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    product?.name,
    product?.brand,
    product?.description,
    product?.url,
  ].some(hasNonLatinText);
}
