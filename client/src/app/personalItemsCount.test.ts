import { describe, expect, it, vi } from "vitest";

import {
  addPersonalItemsChangedListener,
  notifyPersonalItemsChanged,
} from "./personalItemsCount";

describe("personalItemsCount events", () => {
  it("notifies listeners and removes them", () => {
    const listener = vi.fn();
    const removeListener = addPersonalItemsChangedListener(listener);

    notifyPersonalItemsChanged();
    expect(listener).toHaveBeenCalledTimes(1);

    removeListener();
    notifyPersonalItemsChanged();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("is a no-op without window", () => {
    vi.stubGlobal("window", undefined);

    expect(() => notifyPersonalItemsChanged()).not.toThrow();

    const listener = vi.fn();
    const removeListener = addPersonalItemsChangedListener(listener);
    removeListener();

    expect(listener).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
