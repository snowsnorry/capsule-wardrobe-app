import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import {
  clearProfileOptionsCache,
  loadProfileOptions,
} from "../api/profileOptionsCache";
import { useProfileOptions } from "./useProfileOptions";

vi.mock("../api/profileOptionsCache", () => ({
  clearProfileOptionsCache: vi.fn(),
  loadProfileOptions: vi.fn(),
}));

describe("useProfileOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadProfileOptions).mockResolvedValue({
      styles: { core: ["formal"], aesthetics: ["retro"] },
      occasions: ["office"],
      seasons: ["winter", "spring"],
      audience: ["woman"],
      patterns: ["solid"],
    });
  });

  afterEach(cleanup);

  test("loads, sorts seasons, skips already loaded options, and resets cache", async () => {
    const { result } = renderHook(() => useProfileOptions());

    await result.current.ensureOptionsLoaded();

    await waitFor(() => {
      expect(result.current.occasionOptions).toEqual(["office"]);
    });
    expect(result.current.orderedSeasonOptions).toEqual(["spring", "winter"]);

    await result.current.ensureOptionsLoaded();
    expect(loadProfileOptions).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.resetProfileOptions();
    });
    expect(clearProfileOptionsCache).toHaveBeenCalledTimes(1);
    expect(result.current.occasionOptions).toEqual([]);
  });

  test("applies fallback options only when requested", async () => {
    vi.mocked(loadProfileOptions).mockRejectedValue(new Error("failed"));
    const { result } = renderHook(() => useProfileOptions());

    await expect(result.current.preloadOnboardingOptions()).rejects.toThrow(
      "failed",
    );
    await result.current.preloadOnboardingOptions({ useFallback: true });

    await waitFor(() => {
      expect(result.current.occasionOptions.length).toBeGreaterThan(0);
    });
    expect(result.current.patternOptions).toEqual([]);
  });
});
