import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
vi.mock("../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher">locale-switcher</div>,
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

function renderScreen(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <SearchScreen {...props} />
      </LocaleProvider>
    </ThemeProvider>,
  );
}

describe("SearchScreen e2e-style flow", () => {
  beforeEach(() => {
    cleanup();
    mediaQueryMock.mockReset();
    mediaQueryMock.mockReturnValue(false);
    searchApi.fetchSavedSearch.mockReset();
    searchApi.fetchSearchOptions.mockReset();
    searchApi.runSearch.mockReset();

    searchApi.fetchSearchOptions.mockResolvedValue({
      brands: [{ value: "uniqlo", label: "UNIQLO" }],
      categories: ["top", "bottom"],
      seasons: ["summer"],
      formalityLevels: ["casual"],
      styles: ["minimalistic"],
      occasions: ["office"],
      audience: ["woman", "man", "all"],
      colors: ["blue"],
      patterns: ["solid"],
      silhouettes: ["straight"],
      fits: ["regular"],
      closureTypes: ["button"],
      priceRange: { min: 10, max: 150 },
    });
    searchApi.fetchSavedSearch.mockResolvedValue({
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
        page: 1,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("hydrates, submits a refined query, paginates, and opens product detail", async () => {
    searchApi.runSearch
      .mockResolvedValueOnce({
        items: [
          {
            id: "1",
            name: "Linen Shirt",
            brand: "UNIQLO",
            category: "top",
            url: "https://example.com/1",
            description: "Soft linen shirt",
          },
        ],
        total: 120,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "2",
            name: "Blue Cardigan",
            brand: "ARKET",
            category: "top",
            url: "https://example.com/2",
            description: "Lightweight merino layer",
          },
        ],
        total: 120,
      })
      .mockResolvedValueOnce({
        items: [
          {
            id: "3",
            name: "Camel Coat",
            brand: "COS",
            category: "outerwear",
            url: "https://example.com/3",
            description: "Tailored wool coat",
          },
          {
            id: "4",
            name: "Olive Trousers",
            brand: "COS",
            category: "bottom",
            url: "https://example.com/4",
            description: "Structured cotton trousers",
          },
        ],
        total: 120,
      });

    renderScreen();

    const input = await screen.findByDisplayValue("linen shirt");
    expect(await screen.findByText("120 results")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "blue cardigan" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ query: "blue cardigan", page: 1 }),
      );
    });
    await waitFor(() => {
      expect(screen.getAllByText("Blue Cardigan").length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole("button", { name: /Go to page 2/i }));

    await waitFor(() => {
      expect(searchApi.runSearch).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({ query: "blue cardigan", page: 2 }),
      );
    });

    const resultButton = screen.getByRole("button", {
      name: /Olive Trousers COS/i,
    });
    fireEvent.click(resultButton);

    await waitFor(() => {
      expect(screen.getAllByText("Olive Trousers").length).toBeGreaterThan(0);
      expect(
        screen.getByText("Structured cotton trousers"),
      ).toBeInTheDocument();
    });

    const productLink = screen.getAllByRole("link", {
      name: /Olive Trousers/i,
    })[0];
    expect(productLink).toHaveAttribute("href", "https://example.com/4");

    const resultsRegion = resultButton.closest("div");
    expect(resultsRegion).not.toBeNull();
    expect(
      within(resultsRegion).getByText("Olive Trousers"),
    ).toBeInTheDocument();
  });
});
