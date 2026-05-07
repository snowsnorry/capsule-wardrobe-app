import { beforeEach, describe, expect, test, vi } from "vitest";
import { fetchWardrobeFilters } from "./auth";
import {
  clearProfileOptionsCache,
  loadProfileOptions,
} from "./profileOptionsCache";

vi.mock("./auth", () => ({
  fetchWardrobeFilters: vi.fn(),
}));

describe("profileOptionsCache", () => {
  beforeEach(() => {
    clearProfileOptionsCache();
    vi.clearAllMocks();
  });

  test("loads wardrobe filter options once and returns cached values", async () => {
    vi.mocked(fetchWardrobeFilters).mockResolvedValue({
      formalityLevels: ["casual"],
      styles: ["minimalistic"],
      occasions: ["office"],
      seasons: ["summer"],
      audience: ["woman"],
      patterns: ["solid"],
    });

    const first = await loadProfileOptions();
    const second = await loadProfileOptions();

    expect(fetchWardrobeFilters).toHaveBeenCalledTimes(1);
    expect(second.styles).toBe(first.styles);
    expect(second.occasions).toBe(first.occasions);
    expect(first).toEqual({
      styles: {
        core: ["casual"],
        aesthetics: ["minimalistic"],
      },
      occasions: ["office"],
      seasons: ["summer"],
      audience: ["woman"],
      patterns: ["solid"],
    });
  });

  test("shares an in-flight request and falls back to empty arrays for missing fields", async () => {
    vi.mocked(fetchWardrobeFilters).mockResolvedValue({});

    const [first, second] = await Promise.all([
      loadProfileOptions(),
      loadProfileOptions(),
    ]);

    expect(fetchWardrobeFilters).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first).toEqual({
      styles: {
        core: [],
        aesthetics: [],
      },
      occasions: [],
      seasons: [],
      audience: [],
      patterns: [],
    });
  });

  test("clears cached values and in-flight requests", async () => {
    vi.mocked(fetchWardrobeFilters)
      .mockResolvedValueOnce({ occasions: ["office"] })
      .mockResolvedValueOnce({ occasions: ["travel"] });

    await loadProfileOptions();
    clearProfileOptionsCache();
    const reloaded = await loadProfileOptions();

    expect(fetchWardrobeFilters).toHaveBeenCalledTimes(2);
    expect(reloaded.occasions).toEqual(["travel"]);
  });
});
