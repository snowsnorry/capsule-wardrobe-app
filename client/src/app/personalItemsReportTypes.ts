type PersonalItemsReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "unbalanced"
  | "incomplete"
  | "unclear";

type PersonalItemsReportVerdict = {
  llmScore?: number;
  llmStatus?: PersonalItemsReportVerdictStatus | string;
  score?: number;
  status?: PersonalItemsReportVerdictStatus | string;
  summary?: string;
};

type PersonalItemsReportSeverity = "info" | "warning" | "critical" | string;

type PersonalItemsReportTemperatureBandC = {
  min?: number | null;
  max?: number | null;
};

type PersonalItemsReportEstimatedOutfitRange = {
  min?: number | null;
  max?: number | null;
  confidence?: "low" | "medium" | "high" | string;
};

type PersonalItemsReportStyleCluster = {
  label?: string;
  style?: string;
  itemCount?: number;
  representativeItemIds?: string[];
  notes?: string;
};

export type PersonalItemsReportStrength = {
  dimension?: string;
  message?: string;
  supportingItemIds?: string[];
};

export type PersonalItemsReportIssue = {
  code?: string;
  severity?: PersonalItemsReportSeverity;
  dimension?: string;
  message?: string;
  affectedItemIds?: string[];
  suggestion?: string;
};

export type PersonalItemsReportSuggestion = {
  type?:
    | "add"
    | "remove"
    | "replace"
    | "rebalance"
    | "style"
    | "keep"
    | "review_metadata"
    | string;
  priority?: "low" | "medium" | "high" | string;
  targetItemIds?: string[];
  targetCategory?: string | null;
  replacementCategory?: string | null;
  replacementDescription?: string | null;
  expectedImpact?: string;
  message?: string;
};

export type PersonalItemsReport = {
  schemaVersion?: number;
  verdict?: PersonalItemsReportVerdict;
  scores?: {
    coverage?: number;
    outfitReadiness?: number;
    versatility?: number;
    seasonality?: number;
    styleClarity?: number;
    colorHarmony?: number;
    efficiency?: number;
  };
  personalItemsOverview?: {
    itemCount?: number;
    personalItemsSize?: string;
    categoryCounts?: Record<string, number>;
    detectedCategoryBalance?: string;
    dominantStyles?: string[];
    dominantSeasons?: string[];
    dominantFormalityLevels?: string[];
    summaryTags?: string[];
  };
  coverage?: {
    overallScore?: number;
    coreRoleCoverage?: Record<string, string>;
    missingCategories?: string[];
    weakCategories?: string[];
    overrepresentedCategories?: string[];
    bottlenecks?: Array<{
      category?: string;
      severity?: PersonalItemsReportSeverity;
      message?: string;
    }>;
    notes?: string;
  };
  outfitReadiness?: {
    overallScore?: number;
    supportedFormulaTypes?: string[];
    estimatedOutfitRange?: PersonalItemsReportEstimatedOutfitRange;
    mainBlockers?: string[];
    notes?: string;
  };
  versatility?: {
    overallScore?: number;
    mixAndMatchScore?: number;
    repeatabilityScore?: number;
    outfitVariety?: string;
    primaryUseModes?: string[];
    limitingFactors?: string[];
    notes?: string;
  };
  styleProfile?: {
    overallScore?: number;
    primaryStyles?: string[];
    styleClusters?: PersonalItemsReportStyleCluster[];
    fragmentation?: string;
    notes?: string;
  };
  seasonality?: {
    overallScore?: number;
    seasonCoverage?: Record<string, string>;
    primarySeasons?: string[];
    weakSeasons?: string[];
    temperatureBandC?: PersonalItemsReportTemperatureBandC;
    layeringSupport?: string;
    weatherSuitability?: string[];
    weatherLimitations?: string[];
    notes?: string;
  };
  colorAnalysis?: {
    overallScore?: number;
    paletteType?: string;
    baseColors?: string[];
    accentColors?: string[];
    contrastLevel?: string;
    harmony?: string;
    colorGaps?: string[];
    colorRisks?: string[];
    notes?: string;
  };
  efficiency?: {
    overallScore?: number;
    redundancyLevel?: string;
    orphanItemRisk?: string;
    notableRedundancies?: Array<{
      category?: string;
      itemIds?: string[];
      message?: string;
    }>;
    potentialOrphans?: Array<{
      itemIds?: string[];
      reason?: string;
    }>;
    underusedStrengths?: string[];
    notes?: string;
  };
  strengths?: PersonalItemsReportStrength[];
  issues?: PersonalItemsReportIssue[];
  suggestions?: PersonalItemsReportSuggestion[];
  confidence?: {
    overall?: number;
    lowConfidenceAspects?: string[];
    assumptions?: string[];
  };
};
