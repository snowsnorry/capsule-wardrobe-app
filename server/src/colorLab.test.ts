import { expect, test } from "vitest";
import { hexToLab, hexToLabVector } from "./colorLab.js";

function expectLabClose(actual: number[], expected: number[]) {
  expected.forEach((value, index) => {
    expect(actual[index]).toBeCloseTo(value, 2);
  });
}

test("hexToLab converts canonical sRGB colors using the D65 reference white", () => {
  expectLabClose(hexToLab("#000000"), [0, 0, 0]);
  expectLabClose(hexToLab("#ffffff"), [100, 0, 0]);
  expectLabClose(hexToLab("#ff0000"), [53.24, 80.09, 67.2]);
  expect(hexToLabVector("#808080")).toMatch(/^\[[^,]+,[^,]+,[^,]+\]$/);
});

test("hexToLab rejects malformed colors", () => {
  expect(() => hexToLab("808080")).toThrow("invalid_hex_color");
});
