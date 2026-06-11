type OutfitReportItem = {
  id: string;
  itemSource: string | null;
  name: string | null;
  category: string | null;
  brand: string | null;
  audience: string | null;
  season: unknown[];
  formalityLevel: unknown[];
  style: unknown[];
  occasions: unknown[];
  colorBase: unknown[];
  pattern: string | null;
  finish: string | null;
  composition: string | null;
  silhouette: string | null;
  fit: string | null;
  closureType: unknown[];
};

type CategoryCounts = {
  top: number;
  bottom: number;
  midlayer: number;
  outerwear: number;
  dress: number;
  shoes: number;
  bag: number;
  belt: number;
  swimwear: number;
  other: number;
};

type OutfitReportLlmOutput = {
  verdict: {
    status: "valid" | "acceptable_with_notes" | "incomplete" | "incoherent";
    score: number;
    summary: string;
  };
  composition: {
    itemCount: number;
    categoryCounts: CategoryCounts;
    detectedRoles: string[];
    missingCoreRoles: string[];
    extraRoles: string[];
    completeness: "complete" | "partial" | "overbuilt";
  };
  seasonality: {
    primarySeasons: string[];
    secondarySeasons: string[];
    temperatureBandC: {
      min: number | null;
      max: number | null;
    };
    weatherSuitability: string[];
    weatherLimitations: string[];
    seasonScore: number;
  };
  styleProfile: {
    primaryStyle: string;
    secondaryStyles: string[];
    formalityLevel: "casual" | "smart_casual" | "formal";
    occasions: string[];
    styleKeywords: string[];
    styleScore: number;
  };
  compatibility: {
    overallScore: number;
    styleCoherence: number;
    formalityCoherence: number;
    seasonalCoherence: number;
    colorCoherence: number;
    mainStrengths: string[];
    mainRisks: string[];
  };
  colorAnalysis: {
    paletteType: string;
    dominantColors: string[];
    accentColors: string[];
    contrastLevel: string;
    harmony: string;
    colorScore: number;
    notes: string;
  };
  issues: Array<{
    code: string;
    severity: "info" | "warning" | "critical";
    dimension: string;
    message: string;
    affectedItemIds: string[];
    suggestion: string;
  }>;
  suggestions: Array<{
    type: "add" | "remove" | "replace" | "keep" | "adjust";
    priority: "low" | "medium" | "high";
    targetItemIds: string[];
    replacementCategory: string | null;
    replacementDescription: string | null;
    message: string;
  }>;
  confidence: {
    overall: number;
    lowConfidenceAspects: string[];
    assumptions: string[];
  };
};

type OutfitReport = OutfitReportLlmOutput & {
  schemaVersion: 1;
  itemsHash: string;
};

export type { OutfitReport, OutfitReportItem, OutfitReportLlmOutput };
