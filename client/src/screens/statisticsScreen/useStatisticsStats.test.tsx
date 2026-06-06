import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { STATISTICS_FILTERS_STORAGE_KEY } from "./statisticsFilterStorage";
import { useStatisticsStats } from "./useStatisticsStats";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn(),
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
    priceRange: { min: 10, max: 150 },
  };
}

function makeStats(overrides = {}) {
  return {
    total: 120,
    stats: {
      category: [
        { value: "top", count: 70 },
        { value: "bottom", count: 50 },
      ],
      color: [
        { value: "blue", count: 90 },
        { value: "white", count: 30 },
      ],
    },
    priceBuckets: [{ key: "10:50", min: 10, max: 50, count: 30 }],
    ...overrides,
  };
}

function t(key: string) {
  return (
    {
      "errors.generic": "Something went wrong",
      "search.filters.category": "Category",
      "search.filters.likedItemsOnly": "Liked only",
    }[key] || key
  );
}

function StatisticsStatsHarness() {
  const statistics = useStatisticsStats({ t, locale: "en" });

  return (
    <div>
      <div data-testid="total">{statistics.resolvedTotal}</div>
      <div data-testid="chips">
        {statistics.activeChips.map((chip) => chip.label).join("|")}
      </div>
      <button
        type="button"
        onClick={() => statistics.toggleFacetValue("category", "top")}
      >
        toggle category
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.updateDraftState(
            (current) => ({
              ...current,
              likedOnly: !current.likedOnly,
              page: 1,
            }),
            { submit: true },
          )
        }
      >
        toggle liked
      </button>
      <button
        type="button"
        onClick={() => statistics.toggleFacetValue("color", "white")}
      >
        toggle color
      </button>
      <button type="button" onClick={() => statistics.submit()}>
        submit
      </button>
      <button type="button" onClick={() => statistics.reset()}>
        reset
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.deleteActiveChip({
            key: "category:top",
            field: "category",
            value: "top",
            label: "Category: Top",
          })
        }
      >
        delete category chip
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.deleteActiveChip({
            key: "likedOnly:true",
            field: "likedOnly",
            value: "true",
            label: "Liked only",
          })
        }
      >
        delete liked chip
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.deleteActiveChip({
            key: "price",
            field: "price",
            value: "10:150",
            label: "$10-$150",
          })
        }
      >
        delete price chip
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.updateDraftState(
            (current) => ({
              ...current,
              priceEnabled: true,
              priceMinDraft: 20,
              priceMaxDraft: 80,
            }),
            { submit: true },
          )
        }
      >
        enable price
      </button>
      <button
        type="button"
        onClick={() =>
          statistics.updateDraftState(
            (current) => ({
              ...current,
              priceEnabled: true,
              priceMinDraft: 10,
              priceMaxDraft: 150,
            }),
            { submit: true },
          )
        }
      >
        full price
      </button>
    </div>
  );
}

describe("useStatisticsStats", () => {
  beforeEach(() => {
    window.localStorage.clear();
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
      likedOnly: false,
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
      closureType: [],
    });
  });

  test("submits, resets, toggles facets, and deletes active chips", async () => {
    const user = userEvent.setup();
    render(<StatisticsStatsHarness />);
    expect(await screen.findByText("120")).toBeInTheDocument();

    searchApi.fetchSearchStats.mockClear();
    await user.click(screen.getByRole("button", { name: "toggle category" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: ["top"],
        }),
      );
    });
    expect(screen.getByTestId("chips")).toHaveTextContent("Category: Top");
    expect(
      JSON.parse(
        window.localStorage.getItem(STATISTICS_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        category: ["top"],
        likedOnly: false,
      }),
    );

    await user.click(screen.getByRole("button", { name: "toggle liked" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: ["top"],
          likedOnly: true,
        }),
      );
    });
    expect(screen.getByTestId("chips")).toHaveTextContent("Liked only");
    expect(
      JSON.parse(
        window.localStorage.getItem(STATISTICS_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        category: ["top"],
        likedOnly: true,
      }),
    );

    await user.click(screen.getByRole("button", { name: "delete liked chip" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: ["top"],
          likedOnly: false,
        }),
      );
    });
    expect(screen.getByTestId("chips")).not.toHaveTextContent("Liked only");
    expect(
      JSON.parse(
        window.localStorage.getItem(STATISTICS_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        category: ["top"],
        likedOnly: false,
      }),
    );

    await user.click(screen.getByRole("button", { name: "toggle color" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: ["top"],
          color: ["white"],
        }),
      );
    });

    await user.click(
      screen.getByRole("button", { name: "delete category chip" }),
    );
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: [],
          color: ["white"],
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "reset" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          category: [],
          color: [],
        }),
      );
    });
    expect(
      JSON.parse(
        window.localStorage.getItem(STATISTICS_FILTERS_STORAGE_KEY) || "{}",
      ),
    ).toEqual(
      expect.objectContaining({
        category: [],
        color: [],
        likedOnly: false,
      }),
    );
  });

  test("bootstraps filters from local storage", async () => {
    window.localStorage.setItem(
      STATISTICS_FILTERS_STORAGE_KEY,
      JSON.stringify({
        likedOnly: true,
        category: ["top"],
      }),
    );

    render(<StatisticsStatsHarness />);

    expect(await screen.findByText("120")).toBeInTheDocument();
    expect(searchApi.fetchSearchStats).toHaveBeenCalledWith(
      expect.objectContaining({
        category: ["top"],
        likedOnly: true,
      }),
    );
    expect(screen.getByTestId("chips")).toHaveTextContent("Category: Top");
    expect(screen.getByTestId("chips")).toHaveTextContent("Liked only");
  });

  test("handles price chips and failed stats refreshes", async () => {
    const user = userEvent.setup();
    render(<StatisticsStatsHarness />);
    expect(await screen.findByText("120")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "enable price" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          priceMin: 20,
          priceMax: 80,
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "full price" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          priceMin: null,
          priceMax: null,
        }),
      );
    });
    expect(screen.getByTestId("chips")).not.toHaveTextContent(
      "search.filters.price",
    );

    await user.click(screen.getByRole("button", { name: "enable price" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          priceMin: 20,
          priceMax: 80,
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "delete price chip" }));
    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenLastCalledWith(
        expect.objectContaining({
          priceMin: null,
          priceMax: null,
        }),
      );
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
      expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({
        force: true,
      });
    });
  });

  test("does not request stats when options resolve after unmount", async () => {
    let resolveOptions: (value: ReturnType<typeof makeOptions>) => void;
    searchApi.fetchSearchOptions.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOptions = resolve;
      }),
    );

    const view = render(<StatisticsStatsHarness />);
    view.unmount();
    resolveOptions!(makeOptions());

    await waitFor(() => {
      expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({
        force: true,
      });
    });
    expect(searchApi.fetchSearchStats).not.toHaveBeenCalled();
  });

  test("surfaces stats bootstrap failures after options load", async () => {
    searchApi.fetchSearchStats.mockRejectedValueOnce(new Error("failed"));

    render(<StatisticsStatsHarness />);

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalled();
    });
    expect(screen.getByTestId("total")).toHaveTextContent("0");
  });
});
