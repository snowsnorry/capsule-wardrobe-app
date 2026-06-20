import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { PersonalItemsReport } from "../app/appTypes";
import {
  WardrobeReportProgress,
  WardrobeReportSlots,
} from "./WardrobeReportSlots";

const theme = createTheme();

const report: PersonalItemsReport = {
  verdict: {
    score: 0.8,
    status: "good",
    summary: "Ready.",
  },
};

const labels: Record<string, string> = {
  "actions.delete": "Delete",
  "wardrobe.regenerateReport": "Regenerate report",
  "wardrobe.reportGenerating": "Analyzing Personal items",
  "wardrobe.reportOpenMenu": "Open report actions",
  "wardrobe.reportShowDetails": "Show details",
  "wardrobe.reportTitle": "Personal items report",
  "wardrobe.reportVerdict.good": "Good Personal items set",
};

function t(key: string) {
  return labels[key] || key;
}

function renderSlots(
  props: Partial<Parameters<typeof WardrobeReportSlots>[0]> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <WardrobeReportSlots
        disabled={false}
        isPending={false}
        isStale={false}
        items={[]}
        onDelete={vi.fn()}
        onHighlightItemIds={vi.fn()}
        onRegenerate={vi.fn()}
        report={report}
        showFloatingReportInspector={false}
        showInlineCompactReport
        t={t}
        {...props}
      />
    </ThemeProvider>,
  );
}

afterEach(cleanup);

describe("WardrobeReportSlots", () => {
  test("renders pending progress only while report generation is active", () => {
    const { rerender } = render(
      <WardrobeReportProgress isPending={false} t={t} />,
    );

    expect(screen.queryByLabelText("Analyzing Personal items")).toBeNull();

    rerender(<WardrobeReportProgress isPending t={t} />);

    expect(
      screen.getByLabelText("Analyzing Personal items"),
    ).toBeInTheDocument();
  });

  test("renders inline compact report and hides when there is no report", () => {
    const { rerender } = renderSlots();

    expect(screen.getByText("Personal items report")).toBeInTheDocument();
    expect(screen.getByTestId("personal-items-report-score")).toHaveAttribute(
      "data-density",
      "compact",
    );

    rerender(
      <ThemeProvider theme={theme}>
        <WardrobeReportSlots
          disabled={false}
          isPending={false}
          isStale={false}
          items={[]}
          onDelete={vi.fn()}
          onHighlightItemIds={vi.fn()}
          onRegenerate={vi.fn()}
          report={null}
          showFloatingReportInspector={false}
          showInlineCompactReport
          t={t}
        />
      </ThemeProvider>,
    );

    expect(screen.queryByText("Personal items report")).toBeNull();
  });

  test("renders floating inspector layout when requested", () => {
    renderSlots({
      showFloatingReportInspector: true,
      showInlineCompactReport: false,
    });

    expect(
      screen.getByTestId("personal-items-report-floating-inspector"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("personal-items-report-score")).toHaveAttribute(
      "data-density",
      "default",
    );
  });

  test("forwards report actions from inline and floating layouts", () => {
    const onDelete = vi.fn();
    const onRegenerate = vi.fn();
    const { rerender } = renderSlots({ onDelete, onRegenerate });

    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Regenerate report" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    rerender(
      <ThemeProvider theme={theme}>
        <WardrobeReportSlots
          disabled={false}
          isPending={false}
          isStale={false}
          items={[]}
          onDelete={onDelete}
          onHighlightItemIds={vi.fn()}
          onRegenerate={onRegenerate}
          report={report}
          showFloatingReportInspector
          showInlineCompactReport={false}
          t={t}
        />
      </ThemeProvider>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Regenerate report" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onRegenerate).toHaveBeenCalledTimes(2);
    expect(onDelete).toHaveBeenCalledTimes(2);
  });
});
