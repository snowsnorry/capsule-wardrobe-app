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
import type { PersonalItemsReport } from "../app/appTypes";
import PersonalItemsReportPanel from "./PersonalItemsReportPanel";
import {
  getHighlightedPersonalItemsReportItemKeys,
  getPersonalItemsReportTemperatureLabel,
} from "./PersonalItemsReportPanelUtils";

const theme = createTheme();

const labels: Record<string, string> = {
  "actions.delete": "Delete",
  "wardrobe.regenerateReport": "Regenerate report",
  "wardrobe.reportAccentColors": "Accent colors",
  "wardrobe.reportAssumptions": "Assumptions",
  "wardrobe.reportBaseColors": "Base colors",
  "wardrobe.reportColorAnalysis": "Color analysis",
  "wardrobe.reportColorGaps": "Color gaps",
  "wardrobe.reportColorHarmony": "Color harmony",
  "wardrobe.reportColorRisks": "Color risks",
  "wardrobe.reportConfidence": "Confidence",
  "wardrobe.reportContrastLevel": "Contrast level",
  "wardrobe.reportCoverage": "Coverage",
  "wardrobe.reportDetectedCategoryBalance": "Detected category balance",
  "wardrobe.reportDominantFormalityLevels": "Dominant formality levels",
  "wardrobe.reportDominantSeasons": "Dominant seasons",
  "wardrobe.reportDominantStyles": "Dominant styles",
  "wardrobe.reportEfficiency": "Efficiency",
  "wardrobe.reportEstimatedOutfitRange": "Estimated outfit range",
  "wardrobe.reportEstimatedOutfitRangeValue":
    "{min}-{max} outfits, {confidence} confidence",
  "wardrobe.reportExpectedImpact": "Expected impact",
  "wardrobe.reportFragmentation": "Fragmentation",
  "wardrobe.reportHarmony": "Harmony",
  "wardrobe.reportHideDetails": "Hide details",
  "wardrobe.reportIssueSuggestionLabel": "Suggestion:",
  "wardrobe.reportIssues": "Issues",
  "wardrobe.reportItemCount": "{count} items",
  "wardrobe.reportLayeringSupport": "Layering support",
  "wardrobe.reportLimitingFactors": "Limiting factors",
  "wardrobe.reportLowConfidenceAspects": "Low confidence aspects",
  "wardrobe.reportMainBlockers": "Main blockers",
  "wardrobe.reportMissingCategories": "Missing categories",
  "wardrobe.reportMixAndMatchScore": "Mix-and-match score",
  "wardrobe.reportNotableRedundancies": "Notable redundancies",
  "wardrobe.reportOpenMenu": "Open report actions",
  "wardrobe.reportOrphanItemRisk": "Orphan item risk",
  "wardrobe.reportOutdated": "Report may be outdated",
  "wardrobe.reportOutfitReadiness": "Outfit readiness",
  "wardrobe.reportOutfitVariety": "Outfit variety",
  "wardrobe.reportOverallScore": "Overall score",
  "wardrobe.reportOverrepresentedCategories": "Overrepresented categories",
  "wardrobe.reportPaletteType": "Palette type",
  "wardrobe.reportPotentialOrphans": "Potential orphans",
  "wardrobe.reportPrimarySeasons": "Primary seasons",
  "wardrobe.reportPrimaryStyles": "Primary styles",
  "wardrobe.reportPrimaryUseModes": "Primary use modes",
  "wardrobe.reportRedundancyLevel": "Redundancy level",
  "wardrobe.reportRelatedItems": "Items:",
  "wardrobe.reportReplacementCategory": "Replacement category",
  "wardrobe.reportReplacementDescription": "Replacement description",
  "wardrobe.reportRepeatabilityScore": "Repeatability score",
  "wardrobe.reportRoleAccessories": "Accessories",
  "wardrobe.reportRoleBottoms": "Bottoms",
  "wardrobe.reportRoleDresses": "Dresses",
  "wardrobe.reportRoleLayers": "Layers",
  "wardrobe.reportRoleShoes": "Shoes",
  "wardrobe.reportRoleTops": "Tops",
  "wardrobe.reportScoreColorHarmony": "Color harmony",
  "wardrobe.reportScoreCoverage": "Coverage",
  "wardrobe.reportScoreEfficiency": "Efficiency",
  "wardrobe.reportScoreOutfitReadiness": "Outfit readiness",
  "wardrobe.reportScoreSeasonality": "Seasonality",
  "wardrobe.reportScoreStyleClarity": "Style clarity",
  "wardrobe.reportScoreVersatility": "Versatility",
  "wardrobe.reportScores": "Scores",
  "wardrobe.reportSeasonAutumn": "Autumn",
  "wardrobe.reportSeasonSpring": "Spring",
  "wardrobe.reportSeasonSummer": "Summer",
  "wardrobe.reportSeasonWinter": "Winter",
  "wardrobe.reportSeasonality": "Seasonality",
  "wardrobe.reportShowDetails": "Show details",
  "wardrobe.reportStrengths": "Strengths",
  "wardrobe.reportStyleCluster": "Style cluster",
  "wardrobe.reportStyleProfile": "Style profile",
  "wardrobe.reportSummaryTags": "Summary tags",
  "wardrobe.reportSuggestions": "Suggestions",
  "wardrobe.reportSupportedFormulaTypes": "Supported outfit formulas",
  "wardrobe.reportTargetCategory": "Target category",
  "wardrobe.reportTemperatureBand": "Temperature band",
  "wardrobe.reportTemperatureFrom": "from {min}°C",
  "wardrobe.reportTemperatureRange": "{min}–{max}°C",
  "wardrobe.reportTemperatureUpTo": "up to {max}°C",
  "wardrobe.reportTitle": "Personal items report",
  "wardrobe.reportUnderusedStrengths": "Underused strengths",
  "wardrobe.reportUnnamedItem": "Item {id}",
  "wardrobe.reportVerdict.excellent": "Excellent Personal items set",
  "wardrobe.reportVerdict.good": "Good Personal items set",
  "wardrobe.reportVerdict.incomplete": "Incomplete",
  "wardrobe.reportVerdict.unclear": "Unclear",
  "wardrobe.reportVerdict.unbalanced": "Unbalanced",
  "wardrobe.reportVerdict.usable_with_gaps": "Usable with gaps",
  "wardrobe.reportWeakCategories": "Weak categories",
  "wardrobe.reportWeakSeasons": "Weak seasons",
  "wardrobe.reportWeatherLimitations": "Weather limitations",
  "wardrobe.reportWeatherSuitability": "Weather suitability",
};

function t(key: string, params?: Record<string, unknown>) {
  return (labels[key] || key).replace(/\{(\w+)\}/g, (_, paramKey) =>
    String(params?.[paramKey] ?? `{${paramKey}}`),
  );
}

function renderPanel(
  report: PersonalItemsReport,
  overrides: Partial<ComponentProps<typeof PersonalItemsReportPanel>> = {},
) {
  return render(
    <ThemeProvider theme={theme}>
      <PersonalItemsReportPanel
        items={[
          { id: "1", name: "White shirt" },
          { id: "2", name: "Black trousers", wardrobeId: "W2" },
        ]}
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

describe("PersonalItemsReportPanel", () => {
  test("formats temperature labels from seasonality bounds", () => {
    expect(
      getPersonalItemsReportTemperatureLabel(
        {
          seasonality: { temperatureBandC: { min: 5, max: 12 } },
        } as PersonalItemsReport,
        t,
      ),
    ).toBe("5–12°C");
    expect(
      getPersonalItemsReportTemperatureLabel(
        {
          seasonality: { temperatureBandC: { min: 5 } },
        } as PersonalItemsReport,
        t,
      ),
    ).toBe("from 5°C");
    expect(
      getPersonalItemsReportTemperatureLabel(
        {
          seasonality: { temperatureBandC: { max: 12 } },
        } as PersonalItemsReport,
        t,
      ),
    ).toBe("up to 12°C");
  });

  test("resolves personal item ids without URL inference", () => {
    expect(
      getHighlightedPersonalItemsReportItemKeys(
        [
          { id: "1", url: "wardrobe://not-used" },
          { url: "https://example.com/item", wardrobeId: "W2" },
        ],
        ["W2"],
      ),
    ).toEqual(["W2"]);
    expect(
      getHighlightedPersonalItemsReportItemKeys(
        [{ url: "https://example.com/item", wardrobeId: "W2" }],
        ["https://example.com/item"],
      ),
    ).toEqual([]);
  });

  test("uses compact density before details are expanded", () => {
    renderPanel(
      {
        verdict: {
          status: "good",
          score: 0.82,
          summary: "A useful set with a clear casual direction.",
        },
        scores: { coverage: 0.7 },
      },
      { isCompact: true },
    );

    expect(screen.getByTestId("personal-items-report-score")).toHaveAttribute(
      "data-density",
      "compact",
    );
    expect(screen.queryByText("Scores")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show details" }));

    expect(screen.getByText("Scores")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Hide details" }));

    expect(screen.queryByText("Scores")).not.toBeInTheDocument();
  });

  test("keeps report actions disabled while pending and disabled", () => {
    const onDelete = vi.fn();
    const onRegenerate = vi.fn();

    renderPanel(
      {
        verdict: {
          status: "good",
          score: 0.76,
          summary: "Ready.",
        },
      },
      {
        disabled: true,
        isPending: true,
        onDelete,
        onRegenerate,
      },
    );

    expect(
      screen.getByRole("button", { name: "Open report actions" }),
    ).toBeDisabled();
    expect(screen.queryByRole("menuitem")).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onRegenerate).not.toHaveBeenCalled();
  });

  test("runs regenerate and delete actions from the report menu", () => {
    const onDelete = vi.fn();
    const onRegenerate = vi.fn();

    renderPanel(
      {
        verdict: {
          status: "good",
          score: 0.82,
          summary: "Ready.",
        },
      },
      { onDelete, onRegenerate },
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(
      screen.getByRole("menuitem", { name: "Regenerate report" }),
    );
    expect(onRegenerate).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getByRole("button", { name: "Open report actions" }),
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  test("renders requested sections and resolves related item names", () => {
    const onHighlightItemIds = vi.fn();
    renderPanel(buildFullReport(), {
      isStale: true,
      onHighlightItemIds,
    });

    expect(screen.getByText("Report may be outdated")).toBeInTheDocument();
    expect(screen.getByText("Good Personal items set")).toBeInTheDocument();
    expect(screen.getAllByText("Coverage").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("progressbar", { name: "Outfit readiness" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Detected category balance")).toBeInTheDocument();
    expect(screen.getAllByText("Coverage").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Outfit readiness").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Versatility").length).toBeGreaterThan(0);
    expect(screen.getByText("Style profile")).toBeInTheDocument();
    expect(screen.getAllByText("Seasonality").length).toBeGreaterThan(0);
    expect(screen.getByText("Color analysis")).toBeInTheDocument();
    expect(screen.getAllByText("Efficiency").length).toBeGreaterThan(0);
    expect(screen.getByText("Strengths")).toBeInTheDocument();
    expect(screen.getByText("Issues")).toBeInTheDocument();
    expect(screen.getByText("Suggestions")).toBeInTheDocument();
    expect(screen.getByText("Confidence: 72%")).toBeInTheDocument();
    expect(screen.getAllByText(/White shirt/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Black trousers/).length).toBeGreaterThan(0);
    expect(
      screen.getByText("1-8 outfits, Medium confidence"),
    ).toBeInTheDocument();
    expect(screen.getByText("Add simple sneakers.")).toBeInTheDocument();

    const issueItem = screen
      .getByText("Missing shoes block outfits.")
      .closest("li");
    expect(issueItem).toBeTruthy();
    fireEvent.focus(issueItem as HTMLElement);
    fireEvent.blur(issueItem as HTMLElement);
    expect(onHighlightItemIds).toHaveBeenCalledWith(["1"]);
    expect(onHighlightItemIds).toHaveBeenCalledWith([]);
    expect(
      within(
        screen.getByTestId("personal-items-report-scroll-body"),
      ).queryByText("Personal items report"),
    ).toBeNull();
  });

  test("derives verdict label and tone from score bands", () => {
    renderPanel({
      verdict: {
        llmStatus: "unbalanced",
        status: "unbalanced",
        score: 0.91,
        summary: "The original status disagrees with the score.",
      },
    });

    expect(
      screen.getByText("Excellent Personal items set"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("personal-items-report-score")).toHaveAttribute(
      "data-score-tone",
      "success",
    );
  });

  test("renders profile sections with partial optional fields", () => {
    renderPanel({
      verdict: {
        score: 0.6,
        status: "usable_with_gaps",
        summary: "Partial profile.",
      },
      styleProfile: {
        styleClusters: [
          {
            itemCount: 1,
            representativeItemIds: ["missing-id"],
          },
        ],
      },
      seasonality: {
        temperatureBandC: { min: 10 },
      },
      colorAnalysis: {
        paletteType: "monochrome",
      },
      efficiency: {
        notableRedundancies: [{ category: "tops", itemIds: ["1"] }],
        potentialOrphans: [{ itemIds: ["W2"] }],
      },
    });

    expect(screen.getByText("Style profile")).toBeInTheDocument();
    expect(screen.getByText("Style cluster")).toBeInTheDocument();
    expect(screen.getByText(/1 items/)).toBeInTheDocument();
    expect(screen.getAllByText(/Item missing-id/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("from 10°C").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Monochrome").length).toBeGreaterThan(0);
    expect(screen.getByText("Notable redundancies")).toBeInTheDocument();
    expect(screen.getByText("Potential orphans")).toBeInTheDocument();
  });

  test("omits empty profile sections", () => {
    renderPanel({
      verdict: {
        score: 0.5,
        status: "incomplete",
        summary: "Empty details.",
      },
      styleProfile: {},
      seasonality: {},
      colorAnalysis: {},
      efficiency: {},
    });

    expect(screen.queryByText("Style profile")).toBeNull();
    expect(screen.queryByText("Seasonality")).toBeNull();
    expect(screen.queryByText("Color analysis")).toBeNull();
    expect(screen.queryByText("Efficiency")).toBeNull();
  });
});

function buildFullReport(): PersonalItemsReport {
  return {
    verdict: {
      status: "good",
      score: 0.82,
      summary: "A useful set with a clear casual direction.",
    },
    scores: {
      coverage: 0.7,
      outfitReadiness: 0.62,
      versatility: 0.75,
      seasonality: 0.8,
      styleClarity: 0.76,
      colorHarmony: 0.88,
      efficiency: 0.68,
    },
    personalItemsOverview: {
      detectedCategoryBalance: "tops heavy",
      dominantStyles: ["minimalistic"],
      dominantSeasons: ["spring"],
      dominantFormalityLevels: ["casual"],
      summaryTags: ["compact"],
    },
    coverage: {
      overallScore: 0.7,
      coreRoleCoverage: {
        tops: "strong",
        bottoms: "present",
        shoes: "missing",
        layers: "weak",
        dresses: "not needed",
        accessories: "limited",
      },
      missingCategories: ["shoes"],
      weakCategories: ["layers"],
      overrepresentedCategories: ["tops"],
      bottlenecks: [
        { category: "shoes", severity: "critical", message: "No shoes." },
      ],
      notes: "Coverage is usable but incomplete.",
    },
    outfitReadiness: {
      overallScore: 0.62,
      supportedFormulaTypes: ["top_bottom"],
      estimatedOutfitRange: { min: 1, max: 8, confidence: "medium" },
      mainBlockers: ["no shoes"],
      notes: "Most formulas need footwear.",
    },
    versatility: {
      overallScore: 0.75,
      mixAndMatchScore: 0.7,
      repeatabilityScore: 0.8,
      outfitVariety: "moderate",
      primaryUseModes: ["daily"],
      limitingFactors: ["few layers"],
      notes: "Repeatable basics help.",
    },
    styleProfile: {
      overallScore: 0.76,
      primaryStyles: ["minimalistic"],
      fragmentation: "low",
      styleClusters: [
        {
          label: "Clean basics",
          style: "minimalistic",
          itemCount: 2,
          representativeItemIds: ["1", "W2"],
          notes: "Simple core items.",
        },
      ],
      notes: "Style direction is clear.",
    },
    seasonality: {
      overallScore: 0.8,
      seasonCoverage: {
        spring: "strong",
        summer: "good",
        autumn: "limited",
        winter: "weak",
      },
      primarySeasons: ["spring", "summer"],
      weakSeasons: ["winter"],
      temperatureBandC: { min: 8, max: 22 },
      layeringSupport: "limited",
      weatherSuitability: ["dry days"],
      weatherLimitations: ["cold rain"],
      notes: "Best for mild weather.",
    },
    colorAnalysis: {
      overallScore: 0.88,
      paletteType: "neutral",
      baseColors: ["white", "black"],
      accentColors: ["blue"],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorGaps: ["warm accent"],
      colorRisks: ["too monochrome"],
      notes: "The palette is easy to combine.",
    },
    efficiency: {
      overallScore: 0.68,
      redundancyLevel: "medium",
      orphanItemRisk: "low",
      notableRedundancies: [
        {
          category: "tops",
          itemIds: ["1"],
          message: "Several similar shirts.",
        },
      ],
      potentialOrphans: [{ itemIds: ["W2"], reason: "Needs matching shoes." }],
      underusedStrengths: ["neutral base"],
      notes: "A few gaps reduce efficiency.",
    },
    strengths: [
      {
        dimension: "style",
        message: "Clear style base.",
        supportingItemIds: ["1", "W2"],
      },
    ],
    issues: [
      {
        code: "missing-shoes",
        severity: "warning",
        dimension: "coverage",
        message: "Missing shoes block outfits.",
        affectedItemIds: ["1"],
        suggestion: "Add a simple shoe option.",
      },
    ],
    suggestions: [
      {
        type: "add",
        priority: "high",
        message: "Add simple sneakers.",
        expectedImpact: "More complete outfits.",
        targetCategory: "shoes",
        replacementCategory: null,
        replacementDescription: null,
        targetItemIds: ["W2"],
      },
    ],
    confidence: {
      overall: 0.72,
      lowConfidenceAspects: ["weather metadata"],
      assumptions: ["Metadata is current."],
    },
  };
}
