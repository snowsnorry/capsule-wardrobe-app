import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider.jsx";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn()
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../api/search.js", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../components/AppLauncher.jsx", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher.jsx", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));
vi.mock("../components/AccentColorChips.jsx", () => ({
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

import StatisticsScreen from "./StatisticsScreen.jsx";

const theme = createTheme();

function makeOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["top", "bottom"],
    seasons: ["spring", "summer"],
    formalityLevels: ["casual"],
    styles: ["minimalistic"],
    occasions: ["office"],
    audience: ["woman", "man", "any"],
    colors: ["blue", "white"],
    patterns: ["solid", "stripe"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 150 }
  };
}

function makeSavedSearch(overrides = {}) {
  return {
    search: {
      query: "linen shirt",
      brand: [],
      priceMin: null,
      priceMax: null,
      audience: [],
      category: [],
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: [],
      page: 1,
      ...overrides
    }
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
      audience: [
        { value: "woman", count: 80 },
        { value: "man", count: 40 }
      ],
      brand: [
        { value: "uniqlo", count: 20 }
      ],
      color: [
        { value: "blue", count: 90 },
        { value: "white", count: 30 }
      ]
    },
    priceBuckets: [
      { key: "10:50", min: 10, max: 50, count: 30 },
      { key: "50:100", min: 50, max: 100, count: 45 },
      { key: "100:150", min: 100, max: 150, count: 45 }
    ],
    appliedFilters: makeSavedSearch().search,
    ...overrides
  };
}

function renderScreen(props = {}, { layoutMode = "medium" } = {}) {
  mediaQueryMock.mockImplementation((query) => {
    if (String(query).includes("max-width: 1279.95px")) {
      return layoutMode === "overlay";
    }
    if (String(query).includes("min-width: 1680px")) {
      return layoutMode === "large";
    }
    return false;
  });

  return render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <StatisticsScreen onNavigateApp={vi.fn()} {...props} />
      </LocaleProvider>
    </ThemeProvider>
  );
}

describe("StatisticsScreen", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    searchApi.fetchSavedSearch.mockReset();
    searchApi.fetchSearchOptions.mockReset();
    searchApi.fetchSearchStats.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSavedSearch.mockResolvedValue(makeSavedSearch());
    searchApi.fetchSearchStats.mockResolvedValue(makeStats());
  });

  afterEach(() => {
    cleanup();
  });

  test("hydrates from saved search and fetches statistics", async () => {
    renderScreen();

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSavedSearch).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSearchStats).toHaveBeenCalledWith({
      query: "linen shirt",
      brand: [],
      priceMin: null,
      priceMax: null,
      audience: [],
      category: [],
      season: ["summer"],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: [],
      page: 1
    });
    expect(screen.getByTestId("statistics-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-medium");
  });

  test("clicking a donut segment toggles the matching filter and refreshes stats", async () => {
    renderScreen();
    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);

    searchApi.fetchSearchStats.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Category: Top" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalledWith(expect.objectContaining({
        category: ["top"],
        page: 1
      }));
    });
  });

  test("price chart is informational and does not apply price range filters", async () => {
    renderScreen();
    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);

    searchApi.fetchSearchStats.mockClear();
    expect(screen.queryByRole("button", { name: "Price: 50 - 100" })).not.toBeInTheDocument();
    expect(searchApi.fetchSearchStats).not.toHaveBeenCalled();
  });

  test("clicking a color bar toggles the matching color filter", async () => {
    renderScreen();
    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);

    searchApi.fetchSearchStats.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Accent color: White" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalledWith(expect.objectContaining({
        color: ["white"],
        page: 1
      }));
    });
  });

  test("mobile opens the filters dialog", async () => {
    const user = userEvent.setup();
    renderScreen({}, { layoutMode: "overlay" });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText("Open filters"));
    expect(await screen.findByText("Filters")).toBeInTheDocument();
  });
});
