import { describe, expect, test } from "vitest";
import {
  MAX_URLS,
  getFilledProductUrls,
  getNextUrlFields,
  isValidProductUrl,
} from "./WardrobeUrlUploadDialog";

describe("WardrobeUrlUploadDialog model", () => {
  test("accepts only http and https URLs with hostnames", () => {
    expect(isValidProductUrl("https://shop.example.com/product")).toBe(true);
    expect(isValidProductUrl(" http://shop.example.com/product ")).toBe(true);
    expect(isValidProductUrl("example.com/product")).toBe(false);
    expect(isValidProductUrl("ftp://shop.example.com/product")).toBe(false);
    expect(isValidProductUrl("https://")).toBe(false);
  });

  test("adds and trims dynamic URL fields up to the maximum", () => {
    let fields = [""];

    for (let index = 0; index < MAX_URLS; index += 1) {
      fields = getNextUrlFields(
        fields,
        index,
        `https://shop.example.com/product-${index + 1}`,
      );
    }

    expect(fields).toHaveLength(MAX_URLS);
    expect(fields.at(-1)).toBe("https://shop.example.com/product-5");
    expect(
      getNextUrlFields(
        [
          "https://shop.example.com/product-1",
          "https://shop.example.com/product-2",
          "",
        ],
        1,
        "",
      ),
    ).toEqual(["https://shop.example.com/product-1", ""]);
  });

  test("builds a trimmed submit payload from all filled URL fields", () => {
    expect(
      getFilledProductUrls([
        " https://shop.example.com/product-1 ",
        "",
        "http://shop.example.com/product-2",
        "   ",
        "https://shop.example.com/product-3",
      ]),
    ).toEqual([
      "https://shop.example.com/product-1",
      "http://shop.example.com/product-2",
      "https://shop.example.com/product-3",
    ]);
  });
});
