import { test, expect } from "vitest";
import en from "./en.js";
import ru from "./ru.js";

type LocaleShape = null | string | number | boolean | LocaleShape[] | { [key: string]: LocaleShape };

function assertSameShape(left: LocaleShape, right: LocaleShape, path = ""): void {
  expect(typeof left).toBe(typeof right);

  if (left === null || right === null || typeof left !== "object") {
    return;
  }

  expect(Array.isArray(left)).toBe(Array.isArray(right));

  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  expect(leftKeys).toEqual(rightKeys);

  for (const key of leftKeys) {
    const nextPath = path ? `${path}.${key}` : key;
    assertSameShape(
      (left as { [key: string]: LocaleShape })[key],
      (right as { [key: string]: LocaleShape })[key],
      nextPath
    );
  }
}

test("en and ru locale dictionaries keep the same recursive key shape", () => {
  assertSameShape(en, ru);
});
