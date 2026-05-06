import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../../i18n/LocaleProvider";
import { createAppTheme } from "../../theme";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn()
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../../api/search", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../../components/AppLauncher", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>
}));

import StatisticsScreen from "../StatisticsScreen";

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
      ]
    },
    priceBuckets: [
      { key: "10:50", min: 10, max: 50, count: 30 }
    ],
    ...overrides
  };
}

function renderScreen(props = {}, { layoutMode = "medium", themeOverride = theme } = {}) {
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
    <ThemeProvider theme={themeOverride}>
      <LocaleProvider>
        <StatisticsScreen onNavigateApp={vi.fn()} {...props} />
      </LocaleProvider>
    </ThemeProvider>
  );
}

describe("StatisticsLayout", () => {
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

  test("mobile opens the filters dialog", async () => {
    const user = userEvent.setup();
    renderScreen({}, { layoutMode: "overlay" });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText("Open filters"));
    expect(await screen.findByText("Filters")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close filters" })).toBeInTheDocument();

    searchApi.fetchSearchStats.mockClear();
    searchApi.fetchSearchStats.mockResolvedValueOnce(makeStats({ total: 37 }));
    await user.click(screen.getByRole("button", { name: "UNIQLO" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalledWith(expect.objectContaining({
        brand: ["uniqlo"]
      }));
    });

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    await waitFor(() => {
      expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Brand: UNIQLO")).toBeInTheDocument();
    expect((await screen.findAllByText("37")).length).toBeGreaterThan(0);
  });

  test("uses dark paper chart cards in dark mode", async () => {
    renderScreen({}, { themeOverride: createAppTheme("dark") });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);

    const summaryCard = screen.getByTestId("statistics-summary-card");
    const chartCards = screen.getAllByTestId("statistics-card");

    expect(summaryCard).toHaveStyle({ backgroundColor: "rgb(21, 32, 31)" });
    expect(chartCards[0]).toHaveStyle({ backgroundColor: "rgb(21, 32, 31)" });
  });
});
