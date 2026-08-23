import { test, expect } from "vitest";
import {
  assertValidSearchPayload,
  getSearchPayloadValidationFailure,
} from "./searchValidation.js";
import type { SearchOptions, SearchPayload } from "./searchTypes.js";

const options: SearchOptions = {
  brands: [{ value: "uniqlo", label: "UNIQLO" }, "cos"],
  audience: ["woman", "man"],
  categories: ["top", "bottom"],
  formalityLevels: ["casual"],
  styles: ["minimalistic"],
  colors: ["blue"],
  patterns: ["solid"],
  silhouettes: ["straight"],
  fits: ["regular"],
  closureTypes: ["button"],
  seasons: ["summer"],
  occasions: ["office"],
  priceRange: { min: 10, max: 100 },
};

function payload(overrides: Partial<SearchPayload> = {}): SearchPayload {
  return {
    exactColor: null,
    exactColorRange: "balanced",
    brand: ["uniqlo"],
    audience: ["woman"],
    category: ["top"],
    formalityLevel: ["casual"],
    style: ["minimalistic"],
    color: ["blue"],
    pattern: ["solid"],
    silhouette: ["straight"],
    fit: ["regular"],
    closureType: ["button"],
    season: ["summer"],
    occasions: ["office"],
    priceMin: 10,
    priceMax: 100,
    query: "",
    likedOnly: false,
    page: 1,
    ...overrides,
  };
}

function expectInvalidPayload(fn: () => void): void {
  try {
    fn();
  } catch (error) {
    expect(error).toMatchObject({
      message: "invalid_payload",
      code: "invalid_payload",
    });
    return;
  }

  throw new Error("Expected invalid_payload error");
}

test("assertValidSearchPayload accepts allowed facets and valid price ranges", () => {
  expect(() =>
    assertValidSearchPayload(payload({ brand: ["cos"] }), options),
  ).not.toThrow();
  expect(() =>
    assertValidSearchPayload(
      payload({ priceMin: null, priceMax: null }),
      options,
    ),
  ).not.toThrow();
});

test("assertValidSearchPayload rejects unknown facets and invalid price ranges", () => {
  expectInvalidPayload(() =>
    assertValidSearchPayload(payload({ category: ["dress"] }), options),
  );
  expectInvalidPayload(() =>
    assertValidSearchPayload(
      payload({ priceMin: 150, priceMax: 100 }),
      options,
    ),
  );
  expectInvalidPayload(() =>
    assertValidSearchPayload(
      payload({ priceMin: Number.NaN, priceMax: 100 }),
      options,
    ),
  );
});

test("getSearchPayloadValidationFailure classifies facet and price failures", () => {
  expect(
    getSearchPayloadValidationFailure(
      payload({ category: ["dress"] }),
      options,
    ),
  ).toBe("facet");
  expect(
    getSearchPayloadValidationFailure(
      payload({ priceMin: 150, priceMax: 100 }),
      options,
    ),
  ).toBe("price");
  expect(getSearchPayloadValidationFailure(payload(), options)).toBe(null);
});

test("search validation rejects malformed exact colors", () => {
  expect(
    getSearchPayloadValidationFailure(
      payload({ exactColor: "not-a-color" }),
      options,
    ),
  ).toBe("facet");
  expectInvalidPayload(() =>
    assertValidSearchPayload(payload({ exactColor: "#12345g" }), options),
  );
});

test("search validation accepts known exact color ranges and rejects unknown ones", () => {
  expect(
    getSearchPayloadValidationFailure(
      payload({ exactColorRange: "broadest" }),
      options,
    ),
  ).toBe(null);
  expectInvalidPayload(() =>
    assertValidSearchPayload(
      payload({ exactColorRange: "unsupported" as "balanced" }),
      options,
    ),
  );
  expectInvalidPayload(() =>
    assertValidSearchPayload(
      payload({ exactColorRange: "" as "balanced" }),
      options,
    ),
  );
});
