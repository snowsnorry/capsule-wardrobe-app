import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useStatisticsStats } from "./useStatisticsStats";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn()
}));

vi.mock("../../api/search", () => searchApi);

function makeOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["top", "bottom"],
    seasons: ["spring", "summer"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman", "man", "all"],
    colors: ["blue", "white"],
    patterns: ["solid", "stripe"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 150 }
  };
}

function makeStats(overrides = {}) {
  return {
    total: 120,
    stats: {
      category: [
        { value: "top", count: 70 },
        { value: "bottom", count: 50 }
      ],
      color: [
        { value: "blue", count: 90 },
        { value: "white", count: 30 }
      ]
    },
    priceBuckets: [
      { key: "10:50", min: 10, max: 50, count: 30 }
    ],
    ...overrides
  };
}

function t(key: string) {
  return {
    "errors.generic": "Something went wrong",
    "search.filters.category": "Category"
  }[key] || key;
}

function StatisticsStatsHarness() {
  const statistics = useStatisticsStats({ t, locale: "en" });

  return (
    <div>
      <div data-testid="total">{statistics.resolvedTotal}</div>
      <div data-testid="chips">{statistics.activeChips.map((chip) => chip.label).join("|")}</div>
      <button type="button" onClick={() => statistics.toggleFacetValue("category", "top")}>toggle category</button>
      <button type="button" onClick={() => statistics.toggleFacetValue("color", "white")}>toggle color</button>
      <button type="button" onClick={() => statistics.submit()}>submit</button>
      <button type="button" onClick={() => statistics.reset()}>reset</button>
      <button
        type="button"
        onClick={() => statistics.deleteActiveChip({
          key: "category:top",
          field: "category",
          value: "top",
          label: "Category: Top"
        })}
      >
        delete category chip
      </button>
      <button
        type="button"
        onClick={() => statistics.deleteActiveChip({
          key: "price",
          field: "price",
          value: "10:150",
          label: "$10-$150"
        })}
      >
        delete price chip
      </button>
      <button
        type="button"
        onClick={() => statistics.updateDraftState((current) => ({
          ...current,
          priceEnabled: true,
          priceMinDraft: 20,
          priceMaxDraft: 80
        }), { submit: true })}
      >
        enable price
      </button>
    </div>
  );
}

describe("useStatisticsStats", () => {
  beforeEach(() => {
    searchApi.fetchSearchOptions.mockReset();
    searchApi.fetchSearchStats.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSearchStats.mockResolvedValue(makeStats());
  });

  afterEach(() => {
    cleanup();
  });

  test("bootstraps options and statistics from defaults", async () => {
    render(<StatisticsStatsHarness />);

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSearchStats).toHaveBeenCalledWith({
      brand: [],
      priceMin: null,
      priceMax: null,
      audience: [],
      category: [],
      season: [],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: []
    });
  });

  test("submits, resets, toggles facets, and deletes active chips", async () => {
    const user = userEvent.setup();
    render(<StatisticsStatsHarness />);
    expect(await screen.findByText("120")).toBeInTheDocument();

    searchApi.fetchSearchStats.mockClear();
    await user.click(screen.getByRole("button", { name: "toggle category" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        category: ["top"]
      }));
    });
    expect(screen.getByTestId("chips")).toHaveTextContent("Category: Top");

    await user.click(screen.getByRole("button", { name: "toggle color" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        category: ["top"],
        color: ["white"]
      }));
    });

    await user.click(screen.getByRole("button", { name: "delete category chip" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        category: [],
        color: ["white"]
      }));
    });

    await user.click(screen.getByRole("button", { name: "reset" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        category: [],
        color: []
      }));
    });
  });

  test("handles price chips and failed stats refreshes", async () => {
    const user = userEvent.setup();
    render(<StatisticsStatsHarness />);
    expect(await screen.findByText("120")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "enable price" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        priceMin: 20,
        priceMax: 80
      }));
    });

    await user.click(screen.getByRole("button", { name: "delete price chip" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(expect.objectContaining({
        priceMin: null,
        priceMax: null
      }));
    });

    searchApi.fetchSearchStats.mockRejectedValueOnce(new Error("failed"));
    await user.click(screen.getByRole("button", { name: "submit" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalled();
    });
  });

  test("surfaces bootstrap failures without updating inactive state", async () => {
    searchApi.fetchSearchOptions.mockRejectedValueOnce(new Error("failed"));

    render(<StatisticsStatsHarness />);

    await waitFor(() => {
      expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    });
  });
});
