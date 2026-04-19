import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { SHARP_CONCURRENCY, configureSharp } from "./sharpConfig.js";

test("configureSharp disables cache and uses default or override concurrency", () => {
  const originalCache = sharp.cache;
  const originalConcurrency = sharp.concurrency;
  let cacheEnabled = true;
  let concurrencyValue = 0;

  sharp.cache = (value) => {
    if (typeof value === "boolean") {
      cacheEnabled = value;
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
    assert.deepEqual(defaultConfig, {
      cache: {
        memory: { current: 0, high: 0, max: 0 },
        files: { current: 0, max: 0 },
        items: { current: 0, max: 0 }
      },
      concurrency: SHARP_CONCURRENCY
    });

    const overrideConfig = configureSharp(7);
    assert.deepEqual(overrideConfig, {
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
