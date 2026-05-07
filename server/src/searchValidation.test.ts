import assert from "node:assert/strict";
import { test } from "node:test";
import { assertValidSearchPayload } from "./searchValidation.js";
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
  priceRange: { min: 10, max: 100 }
};

function payload(overrides: Partial<SearchPayload> = {}): SearchPayload {
  return {
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
    page: 1,
    ...overrides
  };
}

test("assertValidSearchPayload accepts allowed facets and valid price ranges", () => {
  assert.doesNotThrow(() => assertValidSearchPayload(payload({ brand: ["cos"] }), options));
  assert.doesNotThrow(() => assertValidSearchPayload(payload({ priceMin: null, priceMax: null }), options));
});

test("assertValidSearchPayload rejects unknown facets and invalid price ranges", () => {
  assert.throws(
    () => assertValidSearchPayload(payload({ category: ["dress"] }), options),
    { message: "invalid_payload", code: "invalid_payload" }
  );
  assert.throws(
    () => assertValidSearchPayload(payload({ priceMin: 150, priceMax: 100 }), options),
    { message: "invalid_payload", code: "invalid_payload" }
  );
  assert.throws(
    () => assertValidSearchPayload(payload({ priceMin: Number.NaN, priceMax: 100 }), options),
    { message: "invalid_payload", code: "invalid_payload" }
  );
});
