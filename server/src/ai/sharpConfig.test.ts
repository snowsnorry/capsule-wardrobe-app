import { test, expect } from "vitest";
import sharp from "sharp";
import { SHARP_CONCURRENCY, configureSharp } from "./sharpConfig.js";

test("configureSharp disables cache and uses default or override concurrency", () => {
  const originalCache = sharp.cache;
  const originalConcurrency = sharp.concurrency;
  let concurrencyValue = 0;

  sharp.cache = (value) => {
    if (typeof value === "boolean") {
      expect(value).toBe(false);
    }
    return {
      memory: { current: 0, high: 0, max: 0 },
      files: { current: 0, max: 0 },
      items: { current: 0, max: 0 }
    };
  };
  sharp.concurrency = (value) => {
    if (Number.isInteger(value)) {
      concurrencyValue = value;
    }
    return concurrencyValue;
  };

  try {
    const defaultConfig = configureSharp();
    expect(defaultConfig).toEqual({
      cache: {
        memory: { current: 0, high: 0, max: 0 },
        files: { current: 0, max: 0 },
        items: { current: 0, max: 0 }
      },
      concurrency: SHARP_CONCURRENCY
    });

    const overrideConfig = configureSharp(7);
    expect(overrideConfig).toEqual({
      cache: {
        memory: { current: 0, high: 0, max: 0 },
        files: { current: 0, max: 0 },
        items: { current: 0, max: 0 }
      },
      concurrency: 7
    });
  } finally {
    sharp.cache = originalCache;
    sharp.concurrency = originalConcurrency;
  }
});
