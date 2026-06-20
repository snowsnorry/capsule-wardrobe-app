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

type PersonalItemsReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "unbalanced"
  | "incomplete"
  | "unclear";

type PersonalItemsReportSeverity = "info" | "warning" | "critical";

type PersonalItemsReportLlmOutput = {
  verdict: {
    status: PersonalItemsReportVerdictStatus;
    score: number;
    summary: string;
  };
  scores: {
    coverage: number;
    outfitReadiness: number;
    versatility: number;
    seasonality: number;
    styleClarity: number;
    colorHarmony: number;
    efficiency: number;
  };
  personalItemsOverview: {
    itemCount: number;
    personalItemsSize: string;
    categoryCounts: CategoryCounts;
    detectedCategoryBalance: string;
    dominantStyles: string[];
    dominantSeasons: string[];
    dominantFormalityLevels: string[];
    summaryTags: string[];
  };
  coverage: {
    overallScore: number;
    coreRoleCoverage: {
      tops: string;
      bottoms: string;
      shoes: string;
      layers: string;
      dresses: string;
      accessories: string;
    };
    missingCategories: string[];
    weakCategories: string[];
    overrepresentedCategories: string[];
    bottlenecks: Array<{
      category: string;
      severity: PersonalItemsReportSeverity;
      message: string;
    }>;
    notes: string;
  };
  outfitReadiness: {
    overallScore: number;
    supportedFormulaTypes: string[];
    estimatedOutfitRange: {
      min: number | null;
      max: number | null;
      confidence: "low" | "medium" | "high";
    };
    mainBlockers: string[];
    notes: string;
  };
  versatility: {
    overallScore: number;
    mixAndMatchScore: number;
    repeatabilityScore: number;
    outfitVariety: string;
    primaryUseModes: string[];
    limitingFactors: string[];
    notes: string;
  };
  styleProfile: {
    overallScore: number;
    primaryStyles: string[];
    styleClusters: Array<{
      label: string;
      style: string;
      itemCount: number;
      representativeItemIds: string[];
      notes: string;
    }>;
    fragmentation: string;
    notes: string;
  };
  seasonality: {
    overallScore: number;
    seasonCoverage: {
      spring: string;
      summer: string;
      autumn: string;
      winter: string;
    };
    primarySeasons: string[];
    weakSeasons: string[];
    temperatureBandC: { min: number | null; max: number | null };
    layeringSupport: string;
    weatherSuitability: string[];
    weatherLimitations: string[];
    notes: string;
  };
  colorAnalysis: {
    overallScore: number;
    paletteType: string;
    baseColors: string[];
    accentColors: string[];
    contrastLevel: string;
    harmony: string;
    colorGaps: string[];
    colorRisks: string[];
    notes: string;
  };
  efficiency: {
    overallScore: number;
    redundancyLevel: string;
    orphanItemRisk: string;
    notableRedundancies: Array<{
      category: string;
      itemIds: string[];
      message: string;
    }>;
    potentialOrphans: Array<{
      itemIds: string[];
      reason: string;
    }>;
    underusedStrengths: string[];
    notes: string;
  };
  strengths: Array<{
    dimension: string;
    message: string;
    supportingItemIds: string[];
  }>;
  issues: Array<{
    code: string;
    severity: PersonalItemsReportSeverity;
    dimension: string;
    message: string;
    affectedItemIds: string[];
    suggestion: string;
  }>;
  suggestions: Array<{
    type:
      | "add"
      | "remove"
      | "replace"
      | "rebalance"
      | "style"
      | "keep"
      | "review_metadata";
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

type PersonalItemsReport = Omit<PersonalItemsReportLlmOutput, "verdict"> & {
  verdict: {
    llmScore: number;
    llmStatus: PersonalItemsReportVerdictStatus;
    score: number;
    status: PersonalItemsReportVerdictStatus;
    summary: string;
  };
  schemaVersion: 1;
};

type PersonalItemsReportItem = {
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

export type {
  PersonalItemsReport,
  PersonalItemsReportItem,
  PersonalItemsReportLlmOutput,
  PersonalItemsReportSeverity,
};
