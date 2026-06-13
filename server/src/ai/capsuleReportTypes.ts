import type { OutfitReportItem } from "./outfitReportTypes.js";

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

type CapsuleReportGeneratedOutfit = {
  id: string;
  itemIds: string[];
};

type CapsuleReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "off_target"
  | "incomplete"
  | "incoherent";

type CapsuleReportLlmOutput = {
  verdict: {
    status: CapsuleReportVerdictStatus;
    score: number;
    summary: string;
  };
  capsuleSummary: {
    itemCount: number;
    categoryCounts: CategoryCounts;
    detectedCategoryBalance: string;
    capsuleType: string;
    summaryTags: string[];
  };
  targetAlignment: {
    overallScore: number;
    audienceFit: { score: number; verdict: string; notes: string };
    occasionFit: {
      score: number;
      matchedOccasions: string[];
      weakOccasions: string[];
      notes: string;
    };
    formalityFit: {
      score: number;
      detectedRange: string[];
      targetMatched: boolean;
      notes: string;
    };
    styleFit: {
      score: number;
      primaryDetectedStyle: string;
      secondaryDetectedStyles: string[];
      targetMatched: boolean;
      notes: string;
    };
    accentColorFit: {
      score: number;
      targetAccentColor: string | null;
      presentAs: string;
      notes: string;
    };
    patternFit: {
      score: number;
      targetPattern: string | null;
      verdict: string;
      notes: string;
    };
    additionalInfoFit: {
      score: number;
      interpretedRequirements: string[];
      unmetRequirements: string[];
      notes: string;
    };
  };
  coverage: {
    overallScore: number;
    coreRoleCoverage: {
      tops: string;
      bottoms: string;
      shoes: string;
      layers: string;
      accessories: string;
    };
    missingCategories: string[];
    weakCategories: string[];
    overrepresentedCategories: string[];
    bottlenecks: Array<{
      category: string;
      severity: "info" | "warning" | "critical";
      message: string;
    }>;
    notes: string;
  };
  versatility: {
    overallScore: number;
    mixAndMatchScore: number;
    repeatabilityScore: number;
    outfitVariety: string;
    primaryOutfitModes: string[];
    limitingFactors: string[];
    notes: string;
  };
  cohesion: {
    overallScore: number;
    styleCoherence: number;
    formalityCoherence: number;
    silhouetteCoherence: number;
    materialCoherence: number;
    colorCoherence: number;
    mainStrengths: string[];
    mainRisks: string[];
    notes: string;
  };
  seasonality: {
    overallScore: number;
    primarySeasons: string[];
    secondarySeasons: string[];
    temperatureBandC: { min: number | null; max: number | null };
    layeringSupport: string;
    weatherSuitability: string[];
    weatherLimitations: string[];
    notes: string;
  };
  colorAnalysis: {
    paletteType: string;
    baseColors: string[];
    accentColors: string[];
    targetAccentColor: string | null;
    accentColorUsage: string;
    contrastLevel: string;
    harmony: string;
    colorScore: number;
    notes: string;
  };
  generatedOutfitAssessment: {
    providedOutfitCount: number;
    overallScore: number;
    completeOutfitCount: number;
    weakOutfitCount: number;
    varietyScore: number;
    targetFitScore: number;
    roleCoverageScore: number;
    repetitionScore: number;
    strongestOutfitRefs: string[];
    weakOutfits: Array<{
      outfitId: string;
      severity: "info" | "warning" | "critical";
      issue: string;
      affectedItemIds: string[];
      suggestion: string;
    }>;
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
    type: "add" | "remove" | "replace" | "rebalance" | "keep" | "style";
    priority: "low" | "medium" | "high";
    targetItemIds: string[];
    targetCategory: string | null;
    replacementCategory: string | null;
    replacementDescription: string | null;
    expectedImpact: string;
    message: string;
  }>;
  confidence: {
    overall: number;
    lowConfidenceAspects: string[];
    assumptions: string[];
  };
};

type CapsuleReport = Omit<CapsuleReportLlmOutput, "verdict"> & {
  verdict: {
    llmScore: number;
    score: number;
    status: CapsuleReportVerdictStatus;
    summary: string;
  };
  schemaVersion: 1;
  itemsHash: string;
};

export type {
  CapsuleReport,
  CapsuleReportGeneratedOutfit,
  CapsuleReportLlmOutput,
  OutfitReportItem as CapsuleReportItem,
};
