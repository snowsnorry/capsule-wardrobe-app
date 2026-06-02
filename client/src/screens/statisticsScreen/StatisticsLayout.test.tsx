import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../../i18n/LocaleProvider";
import { createSearchState } from "../../search/searchState";
import { createAppTheme } from "../../theme";
import {
  STATISTICS_DESKTOP_FILTERS_SX,
  STATISTICS_DESKTOP_LAYOUT_SX,
  STATISTICS_DESKTOP_MAIN_CONTENT_SX,
  STATISTICS_DESKTOP_MAIN_SCROLL_SX,
  StatisticsDesktopLayout,
} from "./StatisticsLayout";

const searchApi = vi.hoisted(() => ({
  fetchSearchOptions: vi.fn(),
  fetchSearchStats: vi.fn(),
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../../api/search", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock,
}));
vi.mock("../../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>,
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
    },
    priceBuckets: [{ key: "10:50", min: 10, max: 50, count: 30 }],
    ...overrides,
  };
}

function renderScreen(
  props = {},
  { layoutMode = "medium", themeOverride = theme } = {},
) {
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
    </ThemeProvider>,
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

  test("desktop layout mirrors the capsule and search sizing contract", () => {
    expect(STATISTICS_DESKTOP_LAYOUT_SX.gridTemplateColumns).toEqual({
      lg: "320px minmax(0, 1fr)",
    });
    expect(STATISTICS_DESKTOP_LAYOUT_SX.gap).toEqual({
      xs: 3,
      lg: "40px",
    });
    expect(STATISTICS_DESKTOP_LAYOUT_SX.width).toBe("100%");
    expect(STATISTICS_DESKTOP_LAYOUT_SX.height).toBe("100%");
    expect(STATISTICS_DESKTOP_LAYOUT_SX.overflow).toBe("hidden");
    expect(STATISTICS_DESKTOP_LAYOUT_SX).not.toHaveProperty("pt");
    expect(STATISTICS_DESKTOP_LAYOUT_SX).not.toHaveProperty("pb");

    expect(STATISTICS_DESKTOP_FILTERS_SX.mt).toBe(2);
    expect(STATISTICS_DESKTOP_FILTERS_SX.maxHeight).toBe("calc(100vh - 32px)");
    expect(STATISTICS_DESKTOP_FILTERS_SX.alignSelf).toBe("start");
    expect(STATISTICS_DESKTOP_FILTERS_SX.overflowY).toBe("auto");
    expect(STATISTICS_DESKTOP_FILTERS_SX.p).toBe(3);

    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX.height).toBe("100%");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX.overflowY).toBe("auto");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty("pt");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty("pb");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty("border");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty("borderColor");
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty(
      "borderRadius",
    );
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty(
      "backgroundColor",
    );
    expect(STATISTICS_DESKTOP_MAIN_SCROLL_SX).not.toHaveProperty("p");
    expect(STATISTICS_DESKTOP_MAIN_CONTENT_SX.maxWidth).toEqual({
      lg: "1240px",
    });
    expect(STATISTICS_DESKTOP_MAIN_CONTENT_SX.mr).toBe("auto");
    expect(STATISTICS_DESKTOP_MAIN_CONTENT_SX.pt).toBe(2);
    expect(STATISTICS_DESKTOP_MAIN_CONTENT_SX.pb).toBe(2);
  });

  test("desktop layout renders the main content in the right scroll column", () => {
    render(
      <ThemeProvider theme={theme}>
        <StatisticsDesktopLayout
          title="Filters"
          options={makeOptions()}
          draftState={createSearchState(null, makeOptions().priceRange)}
          status={{ loading: false, error: "" }}
          onDraftStateChange={vi.fn()}
          onApply={vi.fn(async () => undefined)}
          onReset={vi.fn(async () => undefined)}
          summary={<div>summary content</div>}
          chartCards={[<div key="chart">chart content</div>]}
          emptyLabel="Empty"
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Filters")).toBeInTheDocument();
    expect(screen.queryByText("Catalog: Statistics")).not.toBeInTheDocument();
    expect(screen.getByText("summary content")).toBeInTheDocument();
    expect(screen.getByText("chart content")).toBeInTheDocument();
  });

  test("mobile opens the filters dialog", async () => {
    const user = userEvent.setup();
    renderScreen({}, { layoutMode: "overlay" });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    expect(
      getComputedStyle(screen.getByLabelText("Open filters").parentElement!)
        .justifyContent,
    ).toBe("flex-start");
    await user.click(screen.getByLabelText("Open filters"));
    expect(await screen.findByText("Filters")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Cancel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close filters" }),
    ).toBeInTheDocument();

    searchApi.fetchSearchStats.mockClear();
    searchApi.fetchSearchStats.mockResolvedValueOnce(makeStats({ total: 37 }));
    await user.click(screen.getByRole("button", { name: "UNIQLO" }));

    await waitFor(() => {
      expect(searchApi.fetchSearchStats).toHaveBeenCalledWith(
        expect.objectContaining({
          brand: ["uniqlo"],
        }),
      );
    });

    await user.click(screen.getByRole("button", { name: "Close filters" }));
    await waitFor(() => {
      expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Brand: UNIQLO")).toBeInTheDocument();
    expect((await screen.findAllByText("37")).length).toBeGreaterThan(0);
  });

  test("mobile filters dialog uses capsule-sized surfaces in dark mode", async () => {
    const user = userEvent.setup();
    const darkTheme = createAppTheme("dark");
    renderScreen({}, { layoutMode: "overlay", themeOverride: darkTheme });

    expect((await screen.findAllByText("120")).length).toBeGreaterThan(0);
    await user.click(screen.getByLabelText("Open filters"));

    expect(await screen.findByText("Filters")).toBeInTheDocument();
    const header = screen.getByText("Filters").closest(".MuiDialogTitle-root");
    const content = screen
      .getByText("UNIQLO")
      .closest(".MuiDialogContent-root");
    const footer = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");

    expect(getComputedStyle(header!).paddingTop).toBe("12px");
    expect(getComputedStyle(header!).paddingBottom).toBe("8px");
    expect(getComputedStyle(header!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(header!).borderBottomWidth).toBe("");
    expect(getComputedStyle(content!).backgroundColor).toBe("rgb(16, 24, 23)");
    expect(getComputedStyle(content!).overflowY).toBe("auto");
    expect(getComputedStyle(content!).paddingTop).toBe("8px");
    expect(footer).not.toBeNull();
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    const footerButtons = Array.from(footer!.querySelectorAll("button"));
    const resetButton = footerButtons.find(
      (button) => button.textContent === "Reset",
    );
    const applyButton = footerButtons.find(
      (button) => button.textContent === "Apply",
    );
    expect(resetButton).toBeDefined();
    expect(applyButton).toBeDefined();
    expect(
      resetButton!.compareDocumentPosition(applyButton!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(getComputedStyle(footer!).backgroundColor).toBe("rgb(21, 32, 31)");
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
