import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider.jsx";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn()
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

import SearchScreen from "./SearchScreen.jsx";

const theme = createTheme();

function renderScreen(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <SearchScreen onNavigateApp={vi.fn()} {...props} />
      </LocaleProvider>
    </ThemeProvider>
  );
}

function makeOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["top", "bottom"],
    seasons: ["summer", "winter"],
    formalityLevels: ["casual", "formal"],
    styles: ["minimalistic", "retro"],
    occasions: ["office"],
    audience: ["woman", "man", "any"],
    colors: ["blue"],
    patterns: ["solid"],
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
      brand: ["uniqlo"],
      category: [],
      season: ["summer"],
      audience: [],
      formalityLevel: [],
      style: [],
      occasions: [],
      color: [],
      pattern: [],
      silhouette: [],
      fit: [],
      closureType: [],
      priceMin: null,
      priceMax: null,
      page: 3,
      ...overrides
    }
  };
}

function makeResults(items, total = items.length) {
  return { items, total };
}

describe("SearchScreen", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    mediaQueryMock.mockReturnValue(false);
    searchApi.fetchSavedSearch.mockReset();
    searchApi.fetchSearchOptions.mockReset();
    searchApi.runSearch.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSavedSearch.mockResolvedValue(makeSavedSearch());
    searchApi.runSearch.mockResolvedValue(makeResults([
      { id: "1", name: "Linen Shirt", brand: "UNIQLO", category: "top", url: "https://example.com/1" },
      { id: "2", name: "Wool Trousers", brand: "COS", category: "bottom", url: "https://example.com/2" }
    ], 55));
  });

  afterEach(() => {
    cleanup();
  });

  test("hydrates from saved search and runs initial search with serialized state", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSavedSearch).toHaveBeenCalledWith({ force: true });
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "linen shirt",
      brand: ["uniqlo"],
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
      page: 3
    });
    expect(await screen.findByText("55 results")).toBeInTheDocument();
    expect(screen.getAllByText("Linen Shirt").length).toBeGreaterThan(0);
  });

  test("desktop filter interactions auto-apply and reset page to 1", async () => {
    renderScreen();
    await screen.findByDisplayValue("linen shirt");
    searchApi.runSearch.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "Top" }));

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
        category: ["top"],
        page: 1
      }));
    });
  });

  test("search submit and reset update payload and pagination state", async () => {
    renderScreen();
    const input = await screen.findByPlaceholderText(
      "Search in natural language, for example: relaxed blue linen shirt for summer office days"
    );
    searchApi.runSearch.mockClear();

    fireEvent.change(input, { target: { value: "blue cardigan" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenCalledWith(expect.objectContaining({
        query: "blue cardigan",
        page: 1
      }));
    });

    searchApi.runSearch.mockClear();
    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1));

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenCalledWith({
        query: "",
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
        page: 1
      });
    });
  });

  test("mobile opens filters dialog and product detail dialog", async () => {
    mediaQueryMock.mockReturnValue(true);
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open filters"));
    expect(await screen.findByText("Filters")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Cancel" })[0]);
    await waitFor(() => {
      expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Wool Trousers"));
    await waitFor(() => {
      expect(screen.getAllByText("COS").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText("Wool Trousers").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByLabelText("Back"));
    await waitFor(() => {
      expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
    });
  });
});
