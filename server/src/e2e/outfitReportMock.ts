function buildE2eOutfitReport(outfitId: string) {
  return {
    schemaVersion: 1,
    itemsHash: `e2e-items-hash-${outfitId}`,
    verdict: {
      status: "valid",
      llmScore: 0.9,
      score: 0.83,
      summary: "This outfit is ready to wear.",
    },
    composition: {
      itemCount: 0,
      categoryCounts: {
        top: 0,
        bottom: 0,
        midlayer: 0,
        outerwear: 0,
        dress: 0,
        shoes: 0,
        bag: 0,
        belt: 0,
        swimwear: 0,
        other: 0,
      },
      detectedRoles: [],
      missingCoreRoles: [],
      extraRoles: [],
      completeness: "complete",
    },
    seasonality: {
      primarySeasons: ["spring"],
      secondarySeasons: [],
      temperatureBandC: { min: null, max: null },
      weatherSuitability: ["unknown"],
      weatherLimitations: [],
      seasonScore: 0.8,
    },
    styleProfile: {
      primaryStyle: "minimalistic",
      secondaryStyles: [],
      formalityLevel: "casual",
      occasions: ["everyday_errands"],
      styleKeywords: ["e2e"],
      styleScore: 0.8,
    },
    compatibility: {
      overallScore: 0.9,
      styleCoherence: 0.9,
      formalityCoherence: 0.9,
      seasonalCoherence: 0.8,
      colorCoherence: 0.9,
      mainStrengths: ["E2E mock report generated."],
      mainRisks: [],
    },
    colorAnalysis: {
      paletteType: "neutral",
      dominantColors: [],
      accentColors: [],
      contrastLevel: "medium",
      harmony: "cohesive",
      colorScore: 0.8,
      notes: "E2E mock color analysis.",
    },
    issues: [],
    suggestions: [],
    confidence: {
      overall: 0.9,
      lowConfidenceAspects: [],
      assumptions: ["E2E mock response."],
    },
  };
}

export { buildE2eOutfitReport };
