import { expect, test } from "vitest";
import {
  getWardrobeUploadProcessingMetrics,
  resetWardrobeUploadProcessingMetrics,
} from "./wardrobeUploadProcessingMetrics.js";
import {
  assertBufferUnderLimit,
  assertContentLengthUnderLimit,
  createByteLimitedCollector,
} from "./wardrobeUploadByteLimits.js";

test("wardrobe upload byte limits validate response headers conservatively", () => {
  resetWardrobeUploadProcessingMetrics();

  expect(() =>
    assertContentLengthUnderLimit({
      errorCode: "image_url_too_large",
      headers: null,
      maxBytes: 10,
    }),
  ).not.toThrow();
  expect(() =>
    assertContentLengthUnderLimit({
      errorCode: "image_url_too_large",
      headers: new Headers({ "content-length": "not-a-number" }),
      maxBytes: 10,
    }),
  ).not.toThrow();
  expect(() =>
    assertContentLengthUnderLimit({
      errorCode: "image_url_too_large",
      headers: new Headers({ "content-length": "10" }),
      maxBytes: 10,
    }),
  ).not.toThrow();

  expect(() =>
    assertContentLengthUnderLimit({
      errorCode: "image_url_too_large",
      headers: new Headers({ "content-length": "11" }),
      maxBytes: 10,
    }),
  ).toThrow("image_url_too_large");
  expect(
    getWardrobeUploadProcessingMetrics().urlDownloadByteCapRejectedCount,
  ).toBe(1);
});

test("wardrobe upload byte limits validate buffers and streaming chunks", () => {
  resetWardrobeUploadProcessingMetrics();
  const buffer = Buffer.from("small");

  expect(assertBufferUnderLimit(buffer, 5, "image_url_too_large")).toBe(buffer);
  expect(() =>
    assertBufferUnderLimit(Buffer.from("too-large"), 5, "image_url_too_large"),
  ).toThrow("image_url_too_large");

  const collector = createByteLimitedCollector(6, "image_url_too_large");
  expect(collector.hasChunks).toBe(false);
  collector.append(Buffer.from("war"));
  collector.append(new Uint8Array([100, 114, 111]));

  expect(collector.hasChunks).toBe(true);
  expect(collector.getBuffer()).toEqual(Buffer.from("wardro"));
  expect(() => collector.append(Buffer.from("be"))).toThrow(
    "image_url_too_large",
  );
  expect(
    getWardrobeUploadProcessingMetrics().urlDownloadByteCapRejectedCount,
  ).toBe(2);
});
