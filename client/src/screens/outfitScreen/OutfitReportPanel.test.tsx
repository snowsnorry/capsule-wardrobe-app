import { afterEach, describe, expect, test, vi } from "vitest";
import type { ComponentProps } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { OutfitReport } from "../../app/appTypes";
import OutfitReportPanel from "./OutfitReportPanel";

const theme = createTheme();

const labels: Record<string, string> = {
  "actions.delete": "Delete",
  "outfit.regenerateReport": "Regenerate report",
  "outfit.reportConfidence": "Confidence",
  "outfit.reportHideDetails": "Hide details",
  "outfit.reportIssues": "Issues",
  "outfit.reportIssueSuggestionLabel": "Suggestion:",
  "outfit.reportOpenMenu": "Open report actions",
  "outfit.reportOutdated": "Report may be outdated",
  "outfit.reportScoreColorHarmony": "Color harmony",
  "outfit.reportScoreFormalityCoherence": "Formality coherence",
  "outfit.reportScoreOverallCompatibility": "Overall compatibility",
  "outfit.reportScoreSeasonFit": "Season fit",
  "outfit.reportScoreStyleCoherence": "Style coherence",
  "outfit.reportScores": "Scores",
  "outfit.reportShowDetails": "Show details",
  "outfit.reportStrengths": "Strengths",
  "outfit.reportSuggestions": "Suggestions",
  "outfit.reportTitle": "Outfit report",
  "outfit.reportVerdict.acceptable_with_notes": "Has notes",
  "outfit.reportVerdict.valid": "Good match",
};

function t(key: string, params?: Record<string, unknown>) {
  return (labels[key] || key).replace(
    "{percent}",
    String(params?.percent ?? ""),
  );
}

function renderPanel(
  report: OutfitReport,
  overrides: Partial<ComponentProps<typeof OutfitReportPanel>> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <OutfitReportPanel
        onDelete={vi.fn()}
        onHighlightItemIds={vi.fn()}
        onRegenerate={vi.fn()}
        report={report}
        t={t}
        {...overrides}
      />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("OutfitReportPanel", () => {
  test("renders non-compact fallback state without optional sections", () => {
    renderPanel({
      schemaVersion: 1,
      itemsHash: "hash",
      verdict: { status: "", score: "not-a-score", summary: "" },
      seasonality: {},
      styleProfile: {},
      compatibility: {},
      colorAnalysis: {},
      issues: [],
      suggestions: [],
      confidence: {},
    } as unknown as OutfitReport);

    expect(screen.getByText("Outfit report")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("Good match")).toBeInTheDocument();
    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.queryByText("Scores")).not.toBeInTheDocument();
    expect(screen.queryByText("Issues")).not.toBeInTheDocument();
    expect(screen.queryByText("Suggestions")).not.toBeInTheDocument();
    expect(screen.queryByText("Confidence")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Show details" })).toBeNull();
  });

  test("keeps report actions disabled while pending and disabled", () => {
    const onDelete = vi.fn();
    const onRegenerate = vi.fn();

    renderPanel(
      {
        schemaVersion: 1,
        itemsHash: "hash",
        verdict: {
          status: "acceptable_with_notes",
          score: 0.5,
          summary: "Usable with small adjustments.",
        },
        seasonality: { primarySeasons: ["winter"] },
        styleProfile: { formalityLevel: "smart_casual" },
        compatibility: { overallScore: 0.5 },
        colorAnalysis: { paletteType: "neutral" },
        issues: [],
        suggestions: [],
        confidence: {},
      },
      {
        disabled: true,
        isPending: true,
        onDelete,
        onRegenerate,
      },
    );

    expect(
      screen.queryByRole("progressbar", { name: "Generating outfit report" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Has notes")).toBeInTheDocument();
    expect(screen.getByText("Winter")).toBeInTheDocument();
    expect(screen.getByText("Smart Casual")).toBeInTheDocument();

    const menuButton = screen.getByRole("button", {
      name: "Open report actions",
    });
    expect(menuButton).toBeDisabled();

    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  test("uses compact report density before details are expanded", async () => {
    renderPanel(
      {
        schemaVersion: 1,
        itemsHash: "hash",
        verdict: {
          status: "valid",
          score: 0.86,
          summary:
            "A complete casual autumn-leaning outfit with a cohesive minimal streetwear feel and practical everyday styling.",
        },
        seasonality: {
          primarySeasons: ["autumn"],
          secondarySeasons: ["spring"],
        },
        styleProfile: {
          formalityLevel: "casual",
          styleKeywords: ["street_style"],
        },
        compatibility: {
          overallScore: 0.86,
          styleCoherence: 0.9,
        },
        colorAnalysis: { paletteType: "muted_neutral" },
        issues: [],
        suggestions: [],
        confidence: {},
      },
      { isCompact: true },
    );

    expect(screen.getByTestId("outfit-report-score")).toHaveAttribute(
      "data-density",
      "compact",
    );
    expect(screen.queryByText("Style coherence")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Style coherence")).toBeInTheDocument();
  });

  test("renders risk suggestions and confidence branches without item targets", () => {
    const onHighlightItemIds = vi.fn();
    renderPanel(
      {
        schemaVersion: 1,
        itemsHash: "hash",
        verdict: {
          status: "valid",
          score: 0.72,
          summary: "Balanced outfit.",
        },
        seasonality: { seasonScore: 0.8 },
        styleProfile: { styleScore: 0.7 },
        compatibility: {
          colorCoherence: 0.6,
          mainStrengths: ["Clean silhouette."],
          mainRisks: ["Shoes may feel too heavy."],
        },
        colorAnalysis: {},
        issues: [
          {
            message: "Layering needs polish.",
            suggestion: "Add a warmer midlayer.",
          },
        ],
        suggestions: [
          {
            message: "Choose a lighter sneaker.",
          },
        ],
        confidence: {
          overall: 0.82,
          assumptions: ["Weather is inferred."],
          lowConfidenceAspects: ["rain_protection"],
        },
      },
      { onHighlightItemIds },
    );

    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Clean silhouette.")).toBeInTheDocument();
    expect(screen.getByText("Shoes may feel too heavy.")).toBeInTheDocument();
    expect(screen.getByText("Layering needs polish.")).toBeInTheDocument();
    expect(screen.getByText("Choose a lighter sneaker.")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 82%")).toBeInTheDocument();
    expect(screen.queryByText("82% confidence")).not.toBeInTheDocument();
    expect(screen.getByText("Weather is inferred.")).toBeInTheDocument();
    expect(screen.queryByText("Rain Protection")).not.toBeInTheDocument();
    expect(screen.getByTestId("outfit-report-score")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );
    expect(screen.getByTestId("outfit-report-verdict")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(5);
    expect(
      within(screen.getByTestId("outfit-report-scroll-body")).queryByText(
        "Outfit report",
      ),
    ).toBeNull();
    const issueItem = screen.getByText("Layering needs polish.").closest("li");
    expect(issueItem).toBeTruthy();
    expect(issueItem).toHaveTextContent(
      "Layering needs polish.Suggestion: Add a warmer midlayer.",
    );
    expect(screen.getByTestId("outfit-report-issue-suggestion")).toHaveStyle(
      "display: block",
    );

    const untargetedRow = screen
      .getByText("Choose a lighter sneaker.")
      .closest("li");
    expect(untargetedRow).toBeTruthy();
    fireEvent.mouseEnter(untargetedRow as HTMLElement);
    fireEvent.mouseLeave(untargetedRow as HTMLElement);

    expect(onHighlightItemIds).toHaveBeenCalledWith([]);
  });

  test("keeps verdict tone aligned with the report score tone", () => {
    const { rerender } = renderPanel({
      schemaVersion: 1,
      itemsHash: "hash",
      verdict: {
        status: "acceptable_with_notes",
        score: 0.72,
        summary: "Usable with small adjustments.",
      },
      seasonality: {},
      styleProfile: {},
      compatibility: {},
      colorAnalysis: {},
      issues: [],
      suggestions: [],
      confidence: {},
    });

    expect(screen.getByTestId("outfit-report-score")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );
    expect(screen.getByTestId("outfit-report-verdict")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );

    rerender(
      <ThemeProvider theme={theme}>
        <OutfitReportPanel
          onDelete={vi.fn()}
          onHighlightItemIds={vi.fn()}
          onRegenerate={vi.fn()}
          report={
            {
              schemaVersion: 1,
              itemsHash: "hash",
              verdict: {
                status: "valid",
                score: 0.9,
                summary: "Strong match.",
              },
              seasonality: {},
              styleProfile: {},
              compatibility: {},
              colorAnalysis: {},
              issues: [],
              suggestions: [],
              confidence: {},
            } as OutfitReport
          }
          t={t}
        />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("outfit-report-score")).toHaveAttribute(
      "data-score-tone",
      "success",
    );
    expect(screen.getByTestId("outfit-report-verdict")).toHaveAttribute(
      "data-score-tone",
      "success",
    );
  });
});
