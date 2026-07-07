export function buildE2eCapsuleReport(generationNumber: number) {
  const generatedAt = new Date().toISOString();
  return {
    schemaVersion: 1,
    generatedAt,
    verdict: {
      score: 0.81,
      status: "good",
      summary: `E2E capsule report #${generationNumber}: office capsule is cohesive with one shoe risk.`,
    },
    capsuleSummary: {
      itemCount: 3,
      capsuleType: "office capsule",
      detectedCategoryBalance: "balanced core outfit",
    },
    targetAlignment: { overallScore: 0.8 },
    coverage: {
      overallScore: 0.78,
      coreRoleCoverage: {
        tops: "strong",
        bottoms: "strong",
        shoes: "weak",
      },
      weakCategories: ["shoes"],
      notes: "E2E mock coverage uses deterministic capsule fixtures.",
    },
    versatility: {
      overallScore: 0.76,
      notes: "E2E mock report generated.",
    },
    cohesion: {
      overallScore: 0.84,
      mainStrengths: ["Navy and black pieces create a coherent base."],
      mainRisks: ["The sneaker is the main styling risk."],
    },
    colorAnalysis: {
      colorScore: 0.82,
      paletteType: "neutral",
      notes: "Neutral palette is easy to combine.",
    },
    seasonality: {
      overallScore: 0.86,
      primarySeasons: ["spring"],
      temperatureBandC: { min: 10, max: 18 },
      notes: "Best for mild spring weather.",
    },
    generatedOutfitAssessment: {
      providedOutfitCount: 1,
      completeOutfitCount: 1,
      weakOutfitCount: 0,
    },
    issues: [
      {
        code: "shoe-risk",
        message: "White leather sneakers need attention in office outfits.",
        suggestion: "Use cleaner low-profile shoes for formal meetings.",
        affectedItemIds: ["shoes-e2e"],
      },
    ],
    suggestions: [
      {
        type: "replace-item",
        message: "Review the sneaker when building stricter office looks.",
        priority: "medium",
        targetItemIds: ["shoes-e2e"],
      },
    ],
    confidence: {
      overall: 0.91,
      assumptions: ["E2E report uses deterministic fixture products."],
    },
  };
}
