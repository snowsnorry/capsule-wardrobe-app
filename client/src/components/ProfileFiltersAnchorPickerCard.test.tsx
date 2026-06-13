import { describe, expect, test } from "vitest";
import { isAnchorPickerCardDisabled } from "./ProfileFiltersAnchorPickerCard";

describe("isAnchorPickerCardDisabled", () => {
  test("disables only unselected cards when the selection limit is reached", () => {
    expect(
      isAnchorPickerCardDisabled({ selected: false, selectionFull: true }),
    ).toBe(true);
    expect(
      isAnchorPickerCardDisabled({ selected: true, selectionFull: true }),
    ).toBe(false);
    expect(
      isAnchorPickerCardDisabled({ selected: false, selectionFull: false }),
    ).toBe(false);
  });
});
