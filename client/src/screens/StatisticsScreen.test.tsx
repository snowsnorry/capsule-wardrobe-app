import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn()
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../api/search", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../components/AppLauncher", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));
vi.mock("../components/AccentColorChips", () => ({
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

import StatisticsScreen from "./StatisticsScreen";

const theme = createTheme();

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
      audience: [
        { value: "woman", count: 80 },
        { value: "all", count: 40 },
        { value: "man", count: 20 }
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
    searchApi.fetchSearchOptions.mockReset();
    searchApi.fetchSearchStats.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSearchStats.mockResolvedValue(makeStats());
  });

  afterEach(() => {
    cleanup();
  });

  test("renders screen-level statistics summary after bootstrap", async () => {
    renderScreen();

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
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

  test("opens mobile filters dialog and closes it after apply and reset", async () => {
    renderScreen({}, { layoutMode: "overlay" });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Open filters" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });
});
