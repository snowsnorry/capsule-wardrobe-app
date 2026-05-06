import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useStatisticsChartCards } from "./useStatisticsChartCards";
import { createEmptyStatisticsSearchState } from "./statisticsState";
import type { SearchOptions } from "../../search/searchState";

vi.mock("../../components/AccentColorChips", () => ({
  default: ({ options = [], selectedValues = [], onToggle }) => (
    <div data-testid="accent-color-chips">
      {options.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => onToggle(item)}
          aria-pressed={selectedValues.includes(item)}
        >
          {item}
        </button>
      ))}
    </div>
  )
}));

const theme = createTheme();

function makeOptions(): SearchOptions {
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

function t(key: string) {
  return {
    "search.filters.price": "Price",
    "search.filters.brand": "Brand",
    "search.filters.category": "Category",
    "profile.seasonsTitle": "Seasons",
    "profile.audienceTitle": "Audience",
    "statistics.charts.formalityLevel": "Formality",
    "statistics.charts.style": "Style",
    "profile.occasionsTitle": "Occasions",
    "profile.patternTitle": "Pattern",
    "search.filters.silhouette": "Silhouette",
    "search.filters.fit": "Fit",
    "search.filters.closureType": "Closure",
    "profile.accentColorTitle": "Accent color",
    "statistics.chartHint": "Chart hint"
  }[key] || key;
}

function ChartCardsHarness({ onToggleFacetValue = vi.fn() } = {}) {
  const cards = useStatisticsChartCards({
    draftState: createEmptyStatisticsSearchState({ min: 10, max: 150 }),
    locale: "en",
    options: makeOptions(),
    statsState: {
      total: 120,
      stats: {
        category: [
          { value: "top", count: 70 },
          { value: "bottom", count: 50 }
        ],
        audience: [
          { value: "woman", count: 80 },
          { value: "all", count: 40 },
          { value: "man", count: 20 }
        ],
        color: [
          { value: "blue", count: 90 },
          { value: "white", count: 30 }
        ]
      },
      priceBuckets: [
        { key: "10:50", min: 10, max: 50, count: 30 },
        { key: "50:100", min: 50, max: 100, count: 45 }
      ]
    },
    t,
    onToggleFacetValue
  });

  return <ThemeProvider theme={theme}>{cards}</ThemeProvider>;
}

describe("useStatisticsChartCards", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders price as informational and places accent color before facet charts", () => {
    render(<ChartCardsHarness />);

    const cards = screen.getAllByTestId("statistics-card");
    expect(within(cards[0]).getByText("Price")).toBeInTheDocument();
    expect(within(cards[1]).getByText("Accent color")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Price: 50 - 100" })).not.toBeInTheDocument();
  });

  test("shows unisex audience label on the chart and toggles all", () => {
    const onToggleFacetValue = vi.fn();
    render(<ChartCardsHarness onToggleFacetValue={onToggleFacetValue} />);

    fireEvent.click(screen.getByRole("button", { name: "Audience: Unisex" }));

    expect(onToggleFacetValue).toHaveBeenCalledWith("audience", "all");
  });
});
