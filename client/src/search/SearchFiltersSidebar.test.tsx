import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider";
import SearchFiltersSidebar from "./SearchFiltersSidebar";
import { createSearchState } from "./searchState";

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

const theme = createTheme();

const options = {
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

function renderSidebar(props = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <LocaleProvider>
        <SearchFiltersSidebar
          options={options}
          draftState={createSearchState(null, options.priceRange)}
          status={{ loading: false, error: "" }}
          onDraftStateChange={vi.fn()}
          onApply={vi.fn()}
          onReset={vi.fn()}
          autoApply
          {...props}
        />
      </LocaleProvider>
    </ThemeProvider>
  );
}

afterEach(() => {
  cleanup();
});

describe("SearchFiltersSidebar", () => {
  test("sorts pattern chips alphabetically and keeps Not important first", () => {
    renderSidebar();

    const patternSection = screen.getByText("Pattern").parentElement;
    const patternQueries = within(patternSection as HTMLElement);
    const notImportant = patternQueries.getByRole("button", { name: "Not important" });
    const abstract = patternQueries.getByRole("button", { name: "Abstract" });
    const solid = patternQueries.getByRole("button", { name: "Solid" });
    const stripe = patternQueries.getByRole("button", { name: "Stripe" });

    expect(notImportant.compareDocumentPosition(abstract) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(abstract.compareDocumentPosition(solid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(solid.compareDocumentPosition(stripe) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test("sorts core, aesthetics, seasons, and audience display values", () => {
    renderSidebar();

    const coreContainer = screen.getByText("Core").parentElement;
    const aestheticsContainer = screen.getByText("Aesthetics").parentElement;
    const seasonsSection = screen.getByText("Seasons").parentElement;
    const audienceSection = screen.getAllByText("Audience")[0].parentElement;

    const casual = within(coreContainer as HTMLElement).getByRole("button", { name: "Casual" });
    const smartCasual = within(coreContainer as HTMLElement).getByRole("button", { name: "Smart casual" });
    const formal = within(coreContainer as HTMLElement).getByRole("button", { name: "Formal" });
    const notImportant = within(aestheticsContainer as HTMLElement).getByRole("button", { name: "Not important" });
    const boho = within(aestheticsContainer as HTMLElement).getByRole("button", { name: "Boho" });
    const minimalistic = within(aestheticsContainer as HTMLElement).getByRole("button", { name: "Minimalistic" });
    const retro = within(aestheticsContainer as HTMLElement).getByRole("button", { name: "Retro" });
    const spring = within(seasonsSection as HTMLElement).getByRole("button", { name: "Spring" });
    const summer = within(seasonsSection as HTMLElement).getByRole("button", { name: "Summer" });
    const winter = within(seasonsSection as HTMLElement).getByRole("button", { name: "Winter" });
    const audienceLabels = within(audienceSection as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.textContent?.trim())
      .filter(Boolean);

    expect(casual.compareDocumentPosition(smartCasual) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(smartCasual.compareDocumentPosition(formal) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(notImportant.compareDocumentPosition(boho) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(boho.compareDocumentPosition(minimalistic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(minimalistic.compareDocumentPosition(retro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(spring.compareDocumentPosition(summer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(summer.compareDocumentPosition(winter) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(audienceLabels).toEqual(["Not important", "Woman", "Man", "Unisex"]);
  });

  test("auto-applies filter changes and wires reset", () => {
    const onDraftStateChange = vi.fn();
    const onReset = vi.fn();
    renderSidebar({ onDraftStateChange, onReset });

    fireEvent.click(screen.getByRole("button", { name: "Top" }));
    expect(onDraftStateChange).toHaveBeenCalledWith(expect.any(Function), { submit: true });
    const nextState = onDraftStateChange.mock.calls[0][0](createSearchState(null, options.priceRange));
    expect(nextState.category).toEqual(["top"]);
    expect(nextState.page).toBe(1);

    fireEvent.click(screen.getAllByRole("button", { name: "Reset" }).at(-1) as HTMLElement);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
