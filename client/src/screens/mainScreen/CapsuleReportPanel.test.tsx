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
import type { CapsuleReport } from "../../app/appTypes";
import CapsuleReportPanel from "./CapsuleReportPanel";
import {
  getCapsuleOverviewLines,
  getCapsuleReportTemperatureLabel,
} from "./CapsuleReportPanelUtils";

const theme = createTheme();

const labels: Record<string, string> = {
  "actions.delete": "Delete",
  "capsule.regenerateReport": "Regenerate report",
  "capsule.reportConfidence": "Confidence",
  "capsule.reportHideDetails": "Hide details",
  "capsule.reportIssues": "Issues",
  "capsule.reportIssueSuggestionLabel": "Suggestion:",
  "capsule.reportOpenMenu": "Open report actions",
  "capsule.reportOutdated": "Report may be outdated",
  "capsule.reportOverview": "Capsule overview",
  "capsule.reportOverviewCoverage": "Strong coverage for {roles}.",
  "capsule.reportOverviewCoverageWithWeak":
    "Strong coverage for {roles}; {weak} are the main limiting role.",
  "capsule.reportOverviewGeneratedOutfits":
    "{provided} generated outfits provided, {complete} complete, {weak} weak.",
  "capsule.reportOverviewItems": "{count} items",
  "capsule.reportOverviewWeak": "{weak} are the main limiting role.",
  "capsule.reportScoreCategoryCoverage": "Category coverage",
  "capsule.reportScoreCohesion": "Cohesion",
  "capsule.reportScoreColorHarmony": "Color harmony",
  "capsule.reportScoreSeasonFit": "Season fit",
  "capsule.reportScoreTargetFit": "Target fit",
  "capsule.reportScoreVersatility": "Versatility",
  "capsule.reportScores": "Scores",
  "capsule.reportShowDetails": "Show details",
  "capsule.reportStrengths": "Strengths",
  "capsule.reportSuggestions": "Suggestions",
  "capsule.reportTemperatureFrom": "from {min}°C",
  "capsule.reportTemperatureRange": "{min}–{max}°C",
  "capsule.reportTemperatureUpTo": "up to {max}°C",
  "capsule.reportTitle": "Capsule report",
  "capsule.reportVerdict.excellent": "Excellent capsule",
  "capsule.reportVerdict.good": "Good capsule",
  "capsule.reportVerdict.incoherent": "Needs work",
  "capsule.reportVerdict.incomplete": "Incomplete",
  "capsule.reportVerdict.off_target": "Off target",
  "capsule.reportVerdict.usable_with_gaps": "Usable with gaps",
};

function t(key: string, params?: Record<string, unknown>) {
  return (labels[key] || key).replace(/\{(\w+)\}/g, (_, paramKey) =>
    String(params?.[paramKey] ?? `{${paramKey}}`),
  );
}

function renderPanel(
  report: CapsuleReport,
  overrides: Partial<ComponentProps<typeof CapsuleReportPanel>> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <CapsuleReportPanel
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

describe("CapsuleReportPanel", () => {
  test("formats temperature labels from seasonality bounds", () => {
    expect(
      getCapsuleReportTemperatureLabel(
        {
          seasonality: { temperatureBandC: { min: 5, max: 12 } },
        } as CapsuleReport,
        t,
      ),
    ).toBe("5–12°C");
    expect(
      getCapsuleReportTemperatureLabel(
        { seasonality: { temperatureBandC: { min: 5 } } } as CapsuleReport,
        t,
      ),
    ).toBe("from 5°C");
    expect(
      getCapsuleReportTemperatureLabel(
        { seasonality: { temperatureBandC: { max: 12 } } } as CapsuleReport,
        t,
      ),
    ).toBe("up to 12°C");
    expect(
      getCapsuleReportTemperatureLabel({ seasonality: {} } as CapsuleReport, t),
    ).toBeNull();
  });

  test("builds overview lines from summary, coverage, and generated outfits", () => {
    expect(
      getCapsuleOverviewLines(
        {
          capsuleSummary: {
            itemCount: 12,
            capsuleType: "compact capsule",
            detectedCategoryBalance: "balanced category mix",
          },
          coverage: {
            coreRoleCoverage: {
              tops: "strong",
              layers: "strong",
              shoes: "weak",
            },
            weakCategories: ["shoes"],
          },
          generatedOutfitAssessment: {
            providedOutfitCount: 5,
            completeOutfitCount: 4,
            weakOutfitCount: 1,
          },
        },
        t,
      ),
    ).toEqual([
      "12 items · compact capsule · balanced category mix",
      "Strong coverage for Tops, Layers; Shoes are the main limiting role.",
      "5 generated outfits provided, 4 complete, 1 weak.",
    ]);

    expect(
      getCapsuleOverviewLines(
        {
          coverage: { weakCategories: ["bags"] },
        },
        t,
      ),
    ).toEqual(["Bags are the main limiting role."]);
  });

  test("renders fallback report without optional sections", () => {
    renderPanel({
      verdict: { status: "", score: "not-a-score", summary: "" },
      seasonality: {},
      coverage: {},
      cohesion: {},
      colorAnalysis: {},
      issues: [],
      suggestions: [],
      confidence: {},
    } as unknown as CapsuleReport);

    expect(screen.getByText("Capsule report")).toBeInTheDocument();
    expect(screen.getByText("-")).toBeInTheDocument();
    expect(screen.getByText("Good capsule")).toBeInTheDocument();
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
        verdict: {
          status: "usable_with_gaps",
          score: 0.5,
          summary: "Usable with gaps.",
        },
        seasonality: {
          primarySeasons: ["winter"],
          temperatureBandC: { min: 5, max: 12 },
        },
        targetAlignment: {
          formalityFit: { detectedRange: ["smart_casual"] },
        },
        colorAnalysis: { paletteType: "neutral" },
      },
      {
        disabled: true,
        isPending: true,
        onDelete,
        onRegenerate,
      },
    );

    expect(screen.getByText("Off target")).toBeInTheDocument();
    expect(screen.getByText("5–12°C")).toBeInTheDocument();
    expect(screen.getByText("Winter")).toBeInTheDocument();
    expect(screen.getByText("Smart Casual")).toBeInTheDocument();
    expect(screen.getByText("Neutral")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open report actions" }),
    ).toBeDisabled();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  test("uses compact density before details are expanded", () => {
    renderPanel(
      {
        verdict: {
          status: "good",
          score: 0.86,
          summary:
            "A complete casual capsule with a cohesive minimal feel and practical everyday styling.",
        },
        seasonality: { primarySeasons: ["autumn"] },
        styleProfile: {
          formalityLevel: "casual",
          primaryStyle: "minimalistic",
        },
        targetAlignment: { overallScore: 0.8 },
      },
      { isCompact: true },
    );

    expect(screen.getByTestId("capsule-report-score")).toHaveAttribute(
      "data-density",
      "compact",
    );
    expect(screen.queryByText("Target fit")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Target fit")).toBeInTheDocument();
  });

  test("renders scores, overview, issues, suggestions, and confidence", () => {
    const onHighlightItemIds = vi.fn();
    renderPanel(
      {
        verdict: {
          status: "good",
          score: 0.72,
          summary: "Balanced capsule.",
        },
        capsuleSummary: { itemCount: 8 },
        targetAlignment: { overallScore: 0.8 },
        coverage: {
          overallScore: 0.7,
          notes: "Covers daily roles.",
          coreRoleCoverage: { tops: "strong" },
        },
        versatility: { overallScore: 0.6, notes: "Easy to remix." },
        cohesion: {
          overallScore: 0.9,
          mainStrengths: ["Clear silhouette."],
          mainRisks: ["Shoes may limit dressier looks."],
        },
        seasonality: { overallScore: 0.8, notes: "Best in mild weather." },
        colorAnalysis: {
          colorScore: 0.85,
          notes: "Balanced neutral palette.",
        },
        issues: [
          {
            code: "weak-shoes",
            affectedItemIds: ["catalog-1"],
            message: "Shoes limit the capsule.",
            suggestion: "Add a cleaner shoe option.",
          },
        ],
        suggestions: [
          {
            type: "add",
            priority: "high",
            targetItemIds: ["catalog-1"],
            message: "Add low-profile shoes.",
          },
        ],
        confidence: {
          overall: 0.82,
          assumptions: ["Catalog metadata is enough."],
        },
      },
      { isStale: true, onHighlightItemIds },
    );

    expect(screen.getByText("Report may be outdated")).toBeInTheDocument();
    expect(
      screen.getByRole("progressbar", { name: "Target fit" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Capsule overview")).toBeInTheDocument();
    expect(screen.getByText("8 items")).toBeInTheDocument();
    expect(screen.getByText("Clear silhouette.")).toBeInTheDocument();
    expect(screen.getByText("Easy to remix.")).toBeInTheDocument();
    expect(screen.getByText("Shoes limit the capsule.")).toBeInTheDocument();
    expect(screen.getByText("Add low-profile shoes.")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 82%")).toBeInTheDocument();
    expect(screen.getByText("Catalog metadata is enough.")).toBeInTheDocument();
    expect(screen.getByTestId("capsule-report-score")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );
    expect(screen.getByTestId("capsule-report-verdict")).toHaveAttribute(
      "data-score-tone",
      "warning",
    );
    expect(
      within(screen.getByTestId("capsule-report-scroll-body")).queryByText(
        "Capsule report",
      ),
    ).toBeNull();
    const issueItem = screen
      .getByText("Shoes limit the capsule.")
      .closest("li");
    expect(issueItem).toBeTruthy();
    fireEvent.focus(issueItem as HTMLElement);
    fireEvent.blur(issueItem as HTMLElement);
    expect(onHighlightItemIds).toHaveBeenCalledWith(["catalog-1"]);
    expect(onHighlightItemIds).toHaveBeenCalledWith([]);
  });

  test("derives verdict label and tone from score bands", () => {
    renderPanel({
      verdict: {
        llmStatus: "off_target",
        status: "off_target",
        score: 0.76,
        summary: "The original status disagrees with the score.",
      },
      seasonality: {},
      coverage: {},
      cohesion: {},
      colorAnalysis: {},
      issues: [],
      suggestions: [],
      confidence: {},
    });

    expect(screen.getByText("Good capsule")).toBeInTheDocument();
    expect(screen.getByTestId("capsule-report-score")).toHaveAttribute(
      "data-score-tone",
      "success",
    );
    expect(screen.getByTestId("capsule-report-verdict")).toHaveAttribute(
      "data-score-tone",
      "success",
    );
  });

  test("uses low-score LLM incomplete or incoherent status for the verdict label", () => {
    const baseReport = {
      seasonality: {},
      coverage: {},
      cohesion: {},
      colorAnalysis: {},
      issues: [],
      suggestions: [],
      confidence: {},
    };

    const { rerender } = renderPanel({
      ...baseReport,
      verdict: {
        llmStatus: "incoherent",
        status: "good",
        score: 0.25,
        summary: "The capsule conflicts.",
      },
    });

    expect(screen.getByText("Needs work")).toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <CapsuleReportPanel
          onDelete={vi.fn()}
          onHighlightItemIds={vi.fn()}
          onRegenerate={vi.fn()}
          report={
            {
              ...baseReport,
              verdict: {
                llmStatus: "good",
                status: "good",
                score: 0.25,
                summary: "The capsule is too weak.",
              },
            } as CapsuleReport
          }
          t={t}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Incomplete")).toBeInTheDocument();
  });
});
