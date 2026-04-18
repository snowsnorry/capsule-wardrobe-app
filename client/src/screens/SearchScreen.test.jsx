import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider.jsx";

const searchApi = vi.hoisted(() => ({
  fetchSavedSearch: vi.fn(),
  fetchSearchOptions: vi.fn(),
  runSearch: vi.fn()
}));

const mediaQueryMock = vi.hoisted(() => vi.fn());

vi.mock("../api/search", () => searchApi);
vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock
}));
vi.mock("../components/AppLauncher.jsx", () => ({
  default: ({ currentApp }) => <div data-testid="app-launcher">{currentApp}</div>
}));
vi.mock("../components/LocaleSwitcher.jsx", () => ({
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

import SearchScreen from "./SearchScreen.jsx";

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
        <SearchScreen onNavigateApp={vi.fn()} {...props} />
      </LocaleProvider>
    </ThemeProvider>
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
    searchApi.fetchSavedSearch.mockReset();
    searchApi.fetchSearchOptions.mockReset();
    searchApi.runSearch.mockReset();
    searchApi.fetchSearchOptions.mockResolvedValue(makeOptions());
    searchApi.fetchSavedSearch.mockResolvedValue(makeSavedSearch());
    searchApi.runSearch.mockResolvedValue(makeResults([
      { id: "1", name: "Linen Shirt", brand: "UNIQLO", category: "top", url: "https://example.com/1", audience: "all" },
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
    expect(screen.getAllByText("unisex").length).toBeGreaterThan(0);
    expect(screen.getByTestId("search-screen-shell")).toHaveAttribute("data-sidebar-mode", "desktop-medium");
    expect(screen.getByRole("button", { name: "Open user menu" })).toBeInTheDocument();
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
    const user = userEvent.setup();
    renderScreen({}, { layoutMode: "overlay" });

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    expect(screen.queryByText("Capsule Wardrobe")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Toggle sidebar" }));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Collapse sidebar" })).not.toBeInTheDocument();
    });

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

  test("desktop sidebar collapses and expands, and user menu opens on search screen", async () => {
    const user = userEvent.setup();
    const onSignOut = vi.fn();

    renderScreen({
      userEmail: "person@example.com",
      userName: "Person Name",
      settingsProfile: {
        fullname: "Person Name",
        email: "person@example.com",
        locale: "en",
        theme: "system",
        llm: "openai:gpt-5.2"
      },
      onSignOut
    });

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Collapse sidebar" }));
    await user.click(screen.getByTestId("collapsed-sidebar-expand-hitbox"));
    expect(screen.getByRole("button", { name: "Collapse sidebar" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open user menu" }));
    expect(screen.getByText("Settings")).toBeInTheDocument();
    await user.click(screen.getByText("Sign out"));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  test("product detail does not render unsafe product or image urls", async () => {
    searchApi.runSearch.mockResolvedValue(makeResults([
      {
        id: "1",
        name: "Unsafe Shirt",
        brand: "UNIQLO",
        category: "top",
        url: "javascript:alert(1)",
        imageUrl: "data:text/html,<script>alert(1)</script>"
      }
    ]));

    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Unsafe Shirt")[0]);

    await waitFor(() => {
      expect(screen.getAllByText("Unsafe Shirt").length).toBeGreaterThan(0);
    });

    expect(screen.queryByRole("link", { name: /Unsafe Shirt/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Unsafe Shirt" })).not.toBeInTheDocument();
  });

  test("shows unisex suffix in search results and product detail for all-audience items", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    expect(screen.getAllByText("unisex").length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText("Linen Shirt")[0]);

    await waitFor(() => {
      expect(screen.getAllByText("unisex").length).toBeGreaterThan(1);
    });
  });

  test("keeps non-all audience items unchanged in search results and product detail", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();
    const woolTitlesBeforeOpen = screen.getAllByText("Wool Trousers");
    expect(woolTitlesBeforeOpen.length).toBeGreaterThan(0);
    expect(woolTitlesBeforeOpen.every((element) => element.textContent === "Wool Trousers")).toBe(true);

    fireEvent.click(screen.getByText("Wool Trousers"));

    const woolTitlesAfterOpen = await screen.findAllByText("Wool Trousers");
    await waitFor(() => {
      expect(woolTitlesAfterOpen.length).toBeGreaterThan(1);
    });
    expect(woolTitlesAfterOpen.every((element) => element.textContent === "Wool Trousers")).toBe(true);
  });

  test("sorts search pattern chips alphabetically and keeps Not important first", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();

    const patternSection = screen.getByRole("heading", { name: "Pattern" }).parentElement;
    const patternQueries = within(patternSection);
    const notImportant = patternQueries.getByRole("button", { name: "Not important" });
    const abstract = patternQueries.getByRole("button", { name: "Abstract" });
    const solid = patternQueries.getByRole("button", { name: "Solid" });
    const stripe = patternQueries.getByRole("button", { name: "Stripe" });

    expect(notImportant.compareDocumentPosition(abstract) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(abstract.compareDocumentPosition(solid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(solid.compareDocumentPosition(stripe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("sorts core, aesthetics, and seasons to match the main screen rules", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();

    const stylesSection = screen.getByRole("heading", { name: "Style preferences" }).parentElement;
    const coreLabel = within(stylesSection).getByText("Core");
    const aestheticsLabel = within(stylesSection).getByText("Aesthetics");
    const coreContainer = coreLabel.parentElement;
    const aestheticsContainer = aestheticsLabel.parentElement;
    const seasonsSection = screen.getByRole("heading", { name: "Seasons" }).parentElement;

    const casual = within(coreContainer).getByRole("button", { name: "Casual" });
    const smartCasual = within(coreContainer).getByRole("button", { name: "Smart casual" });
    const formal = within(coreContainer).getByRole("button", { name: "Formal" });
    const notImportant = within(aestheticsContainer).getByRole("button", { name: "Not important" });
    const boho = within(aestheticsContainer).getByRole("button", { name: "Boho" });
    const minimalistic = within(aestheticsContainer).getByRole("button", { name: "Minimalistic" });
    const retro = within(aestheticsContainer).getByRole("button", { name: "Retro" });
    const spring = within(seasonsSection).getByRole("button", { name: "Spring" });
    const summer = within(seasonsSection).getByRole("button", { name: "Summer" });
    const winter = within(seasonsSection).getByRole("button", { name: "Winter" });

    expect(casual.compareDocumentPosition(smartCasual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(smartCasual.compareDocumentPosition(formal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notImportant.compareDocumentPosition(boho) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(boho.compareDocumentPosition(minimalistic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(minimalistic.compareDocumentPosition(retro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(spring.compareDocumentPosition(summer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summer.compareDocumentPosition(winter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("sorts audience to match the main screen order", async () => {
    renderScreen();

    expect(await screen.findByDisplayValue("linen shirt")).toBeInTheDocument();

    const audienceSection = screen.getByRole("heading", { name: "Audience" }).parentElement;
    const labels = within(audienceSection)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(labels).toEqual(["Not important", "Woman", "Man", "Unisex"]);
  });
});
