import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn(),
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../api/search", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock,
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
  ),
}));

import SearchScreen from "./SearchScreen";

const theme = createTheme();

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
        <SearchScreen {...props} />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

function makeOptions() {
  return {
    brands: [{ value: "uniqlo", label: "UNIQLO" }],
    categories: ["top", "bottom"],
    seasons: ["winter", "summer", "spring"],
    formalityLevels: ["formal", "casual", "smart_casual"],
    styles: ["retro", "minimalistic", "boho"],
    occasions: ["office"],
    audience: ["woman", "man", "all"],
    colors: ["blue"],
    patterns: ["stripe", "solid", "abstract"],
    silhouettes: ["straight"],
    fits: ["regular"],
    closureTypes: ["button"],
    priceRange: { min: 10, max: 150 },
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
      ...overrides,
    },
  };
}

function makeResults(items, total = items.length) {
  return { items, total };
}

describe("SearchScreen", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    searchApi.fetchSavedSearch.mockReset();
    searchApi.fetchSearchOptions.mockReset();
    searchApi.runSearch.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSavedSearch.mockResolvedValue(makeSavedSearch());
    searchApi.runSearch.mockResolvedValue(
      makeResults(
        [
          {
            id: "1",
            name: "Linen Shirt",
            brand: "UNIQLO",
            category: "top",
            url: "https://example.com/1",
            audience: "all",
          },
          {
            id: "2",
            name: "Wool Trousers",
            brand: "COS",
            category: "bottom",
            url: "https://example.com/2",
          },
        ],
        55,
      ),
    );
  });

  afterEach(() => {
    cleanup();
  });

  test("desktop hydrates saved search and renders results", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    expect(screen.queryByText("Catalog: Explore")).not.toBeInTheDocument();
    expect(searchApi.fetchSearchOptions).toHaveBeenCalledWith({ force: true });
    expect(searchApi.fetchSavedSearch).toHaveBeenCalledWith({ force: true });
    expect(searchApi.runSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        query: "linen shirt",
        brand: ["uniqlo"],
        season: ["summer"],
        page: 3,
      }),
    );
    expect(await screen.findByText("55 results")).toBeInTheDocument();
    expect(screen.getAllByText("Linen Shirt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("unisex").length).toBeGreaterThan(0);
  });

  test("desktop save action marks selected catalog result as saved", async () => {
    const onSaveToPersonalItems = vi.fn(async () => undefined);
    renderScreen({ onSaveToPersonalItems });

    expect(await screen.findByText("55 results")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Product actions"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Save to Personal items" }),
    );

    await waitFor(() => {
      expect(onSaveToPersonalItems).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
      );
    });
    await waitFor(() => {
      expect(screen.getAllByLabelText("Saved").length).toBeGreaterThan(0);
    });
  });

  test("desktop remove action confirms and clears selected saved result", async () => {
    const onRemoveFromPersonalItems = vi.fn(async () => undefined);
    searchApi.runSearch.mockResolvedValueOnce(
      makeResults([
        {
          id: "1",
          name: "Linen Shirt",
          brand: "UNIQLO",
          category: "top",
          url: "https://example.com/1",
          isSavedToWardrobe: true,
        },
      ]),
    );
    renderScreen({ onRemoveFromPersonalItems });

    await waitFor(() => {
      expect(screen.getAllByLabelText("Saved").length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByLabelText("Product actions"));
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Remove from Personal items" }),
    );
    expect(onRemoveFromPersonalItems).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(onRemoveFromPersonalItems).toHaveBeenCalledWith(
        expect.objectContaining({ id: "1" }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByLabelText("Saved")).not.toBeInTheDocument();
    });
  });

  test("initial query handoff replaces saved filters on first search", async () => {
    renderScreen({ initialQuery: "https://example.com/products/linen-shirt" });

    expect(
      await screen.findByDisplayValue(
        "https://example.com/products/linen-shirt",
      ),
    ).toBeInTheDocument();
    expect(searchApi.runSearch).toHaveBeenCalledWith({
      query: "https://example.com/products/linen-shirt",
      exactColor: null,
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
      page: 1,
    });
  });

  test("mobile composition opens filters and product detail", async () => {
    renderScreen({}, { layoutMode: "overlay" });

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("Open filters"));
    expect(await screen.findByText("Filters")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close filters" }));
    await waitFor(() => {
      expect(screen.queryByText("Filters")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Wool Trousers"));
    await waitFor(() => {
      expect(screen.getAllByText("COS").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Product details")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    expect(screen.queryByLabelText("Back")).not.toBeInTheDocument();
  });
});
