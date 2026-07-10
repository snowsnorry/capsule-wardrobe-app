import { existsSync } from "node:fs";
import { logInfo } from "./logger.js";

export function logPdfEvent(event, payload = {}) {
  logInfo(`pdf.${String(event).replace(/[-_]+/g, ".")}`, payload);
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
