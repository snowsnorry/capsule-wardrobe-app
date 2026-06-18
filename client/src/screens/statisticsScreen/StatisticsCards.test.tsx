import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { StatisticsSummaryCard } from "./StatisticsCards";

const theme = createTheme();

describe("StatisticsSummaryCard", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders pattern swatches in active filter chips", () => {
    render(
      <ThemeProvider theme={theme}>
        <StatisticsSummaryCard
          title="Statistics"
          subtitle="Summary"
          totalLabel="12"
          chips={[
            {
              key: "pattern:solid,argyle",
              field: "pattern",
              values: ["solid", "argyle"],
              optionGroup: "patterns",
              title: "Pattern",
              label: "Pattern: Solid, Argyle",
              valueLabels: ["Solid", "Argyle"],
            },
          ]}
          isLoading={false}
          onDeleteChip={vi.fn()}
          activeFiltersLabel="Active filters"
          noActiveFiltersLabel="No active filters"
        />
      </ThemeProvider>,
    );

    const chipRoot = screen.getByTestId("active-filter-chip-pattern");
    expect(
      chipRoot.querySelector('[data-pattern-swatch="solid"]'),
    ).not.toBeNull();
    const emptySlot = chipRoot.querySelector(
      '[data-pattern-swatch-empty="argyle"]',
    );
    expect(emptySlot).not.toBeNull();
    expect(emptySlot).toHaveStyle({ width: "18px", height: "18px" });
  });
});
