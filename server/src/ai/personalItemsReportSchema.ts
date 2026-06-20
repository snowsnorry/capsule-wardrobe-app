import type { JsonSchema, JsonSchemaFormat } from "./types.js";
import {
  CATEGORY_KEYS,
  COLOR_VALUES,
  CONFIDENCE_ASPECT_VALUES,
  COVERAGE_LEVEL_VALUES,
  COVERAGE_LEVEL_WITH_NOT_APPLICABLE_VALUES,
  FORMALITY_VALUES,
  REPORT_DIMENSION_VALUES,
  SEASON_VALUES,
  STYLE_VALUES,
  WEATHER_VALUES,
} from "./personalItemsReportSchemaValues.js";

function enumString(values: string[], description?: string): JsonSchema {
  return {
    type: "string",
    enum: values,
    ...(description ? { description } : {}),
  };
}

function stringSchema(description?: string): JsonSchema {
  return {
    type: "string",
    ...(description ? { description } : {}),
  };
}

function numberSchema(description?: string): JsonSchema {
  return {
    type: "number",
    minimum: 0,
    maximum: 1,
    ...(description ? { description } : {}),
  };
}

function integerSchema(description?: string): JsonSchema {
  return {
    type: "integer",
    minimum: 0,
    ...(description ? { description } : {}),
  };
}

function nullableString(description?: string): JsonSchema {
  return {
    type: ["string", "null"],
    ...(description ? { description } : {}),
  };
}

function nullableEnumString(
  values: string[],
  description?: string,
): JsonSchema {
  return {
    type: ["string", "null"],
    enum: [...values, null],
    ...(description ? { description } : {}),
  };
}

function nullableNumber(description?: string): JsonSchema {
  return {
    type: ["number", "null"],
    ...(description ? { description } : {}),
  };
}

function nullableInteger(description?: string): JsonSchema {
  return {
    type: ["integer", "null"],
    ...(description ? { description } : {}),
  };
}

function arrayOf(items: JsonSchema, description?: string): JsonSchema {
  return {
    type: "array",
    items,
    ...(description ? { description } : {}),
  };
}

function objectSchema(
  properties: Record<string, JsonSchema>,
  required = Object.keys(properties),
  description?: string,
): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
    ...(description ? { description } : {}),
  };
}

function buildCategoryCountsSchema(): JsonSchema {
  return objectSchema(
    Object.fromEntries(
      CATEGORY_KEYS.map((category) => [category, integerSchema()]),
    ),
    [...CATEGORY_KEYS],
  );
}

function categorySchema(description?: string): JsonSchema {
  return enumString([...CATEGORY_KEYS], description);
}

function coverageLevelSchema(includeNotApplicable = false): JsonSchema {
  return enumString(
    includeNotApplicable
      ? COVERAGE_LEVEL_WITH_NOT_APPLICABLE_VALUES
      : COVERAGE_LEVEL_VALUES,
  );
}

function buildVerdictSchema(): JsonSchema {
  return objectSchema({
    status: enumString([
      "excellent",
      "good",
      "usable_with_gaps",
      "unbalanced",
      "incomplete",
      "unclear",
    ]),
    score: numberSchema("Overall personal items quality score from 0 to 1."),
    summary: stringSchema(
      "One concise user-facing English sentence explaining the verdict.",
    ),
  });
}

function buildScoresSchema(): JsonSchema {
  return objectSchema({
    coverage: numberSchema(),
    outfitReadiness: numberSchema(),
    versatility: numberSchema(),
    seasonality: numberSchema(),
    styleClarity: numberSchema(),
    colorHarmony: numberSchema(),
    efficiency: numberSchema(),
  });
}

function buildOverviewSchema(): JsonSchema {
  return objectSchema({
    itemCount: integerSchema("Total number of personal items."),
    personalItemsSize: enumString([
      "small",
      "moderate",
      "large",
      "extensive",
      "unclear",
    ]),
    categoryCounts: buildCategoryCountsSchema(),
    detectedCategoryBalance: enumString([
      "balanced",
      "top_heavy",
      "bottom_heavy",
      "outerwear_heavy",
      "shoe_limited",
      "accessory_heavy",
      "fragmented",
      "unclear",
    ]),
    dominantStyles: arrayOf(enumString(STYLE_VALUES)),
    dominantSeasons: arrayOf(enumString(SEASON_VALUES)),
    dominantFormalityLevels: arrayOf(enumString(FORMALITY_VALUES)),
    summaryTags: arrayOf(stringSchema()),
  });
}

function buildCoverageSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    coreRoleCoverage: objectSchema({
      tops: coverageLevelSchema(),
      bottoms: coverageLevelSchema(),
      shoes: coverageLevelSchema(),
      layers: coverageLevelSchema(),
      dresses: coverageLevelSchema(true),
      accessories: coverageLevelSchema(true),
    }),
    missingCategories: arrayOf(categorySchema()),
    weakCategories: arrayOf(categorySchema()),
    overrepresentedCategories: arrayOf(categorySchema()),
    bottlenecks: arrayOf(
      objectSchema({
        category: categorySchema(),
        severity: enumString(["info", "warning", "critical"]),
        message: stringSchema(),
      }),
    ),
    notes: stringSchema(),
  });
}

function buildOutfitReadinessSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    supportedFormulaTypes: arrayOf(
      enumString([
        "top_bottom_shoes",
        "dress_shoes",
        "layered_outfits",
        "smart_casual_outfits",
        "warm_weather_outfits",
        "cool_weather_outfits",
        "occasion_specific_outfits",
      ]),
    ),
    estimatedOutfitRange: objectSchema({
      min: nullableInteger(),
      max: nullableInteger(),
      confidence: enumString(["low", "medium", "high"]),
    }),
    mainBlockers: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildVersatilitySchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    mixAndMatchScore: numberSchema(),
    repeatabilityScore: numberSchema(),
    outfitVariety: enumString([
      "very_low",
      "low",
      "moderate",
      "high",
      "very_high",
      "unclear",
    ]),
    primaryUseModes: arrayOf(
      enumString([
        "everyday",
        "office",
        "travel",
        "evening",
        "warm_weather",
        "cool_weather",
        "layered",
        "minimal",
        "statement",
        "sporty",
      ]),
    ),
    limitingFactors: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildStyleProfileSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    primaryStyles: arrayOf(enumString(STYLE_VALUES)),
    styleClusters: arrayOf(
      objectSchema({
        label: stringSchema(),
        style: enumString(STYLE_VALUES),
        itemCount: integerSchema(),
        representativeItemIds: arrayOf(stringSchema()),
        notes: stringSchema(),
      }),
    ),
    fragmentation: enumString(["low", "moderate", "high", "unclear"]),
    notes: stringSchema(),
  });
}

function buildSeasonalitySchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    seasonCoverage: objectSchema({
      spring: coverageLevelSchema(),
      summer: coverageLevelSchema(),
      autumn: coverageLevelSchema(),
      winter: coverageLevelSchema(),
    }),
    primarySeasons: arrayOf(enumString(SEASON_VALUES)),
    weakSeasons: arrayOf(enumString(SEASON_VALUES)),
    temperatureBandC: objectSchema({
      min: nullableNumber(),
      max: nullableNumber(),
    }),
    layeringSupport: enumString([
      "none",
      "limited",
      "moderate",
      "strong",
      "unclear",
    ]),
    weatherSuitability: arrayOf(enumString(WEATHER_VALUES)),
    weatherLimitations: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildColorAnalysisSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    paletteType: enumString([
      "neutral",
      "muted_neutral",
      "tonal",
      "high_contrast",
      "color_blocked",
      "mixed",
      "fragmented",
      "unclear",
    ]),
    baseColors: arrayOf(enumString(COLOR_VALUES)),
    accentColors: arrayOf(enumString(COLOR_VALUES)),
    contrastLevel: enumString([
      "low",
      "low_to_medium",
      "medium",
      "high",
      "unclear",
    ]),
    harmony: enumString([
      "cohesive",
      "acceptable",
      "mixed",
      "conflicting",
      "unclear",
    ]),
    colorGaps: arrayOf(stringSchema()),
    colorRisks: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildEfficiencySchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    redundancyLevel: enumString(["low", "moderate", "high", "unclear"]),
    orphanItemRisk: enumString(["low", "moderate", "high", "unclear"]),
    notableRedundancies: arrayOf(
      objectSchema({
        category: categorySchema(),
        itemIds: arrayOf(stringSchema()),
        message: stringSchema(),
      }),
    ),
    potentialOrphans: arrayOf(
      objectSchema({
        itemIds: arrayOf(stringSchema()),
        reason: stringSchema(),
      }),
    ),
    underusedStrengths: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildStrengthSchema(): JsonSchema {
  return objectSchema({
    dimension: enumString(REPORT_DIMENSION_VALUES),
    message: stringSchema(),
    supportingItemIds: arrayOf(stringSchema()),
  });
}

function buildIssueSchema(): JsonSchema {
  return objectSchema({
    code: stringSchema(),
    severity: enumString(["info", "warning", "critical"]),
    dimension: enumString(REPORT_DIMENSION_VALUES),
    message: stringSchema(),
    affectedItemIds: arrayOf(stringSchema()),
    suggestion: stringSchema(),
  });
}

function buildSuggestionSchema(): JsonSchema {
  return objectSchema({
    type: enumString([
      "add",
      "remove",
      "replace",
      "rebalance",
      "style",
      "keep",
      "review_metadata",
    ]),
    priority: enumString(["low", "medium", "high"]),
    targetItemIds: arrayOf(stringSchema()),
    targetCategory: nullableEnumString([...CATEGORY_KEYS]),
    replacementCategory: nullableEnumString([...CATEGORY_KEYS]),
    replacementDescription: nullableString(),
    expectedImpact: enumString([
      "improve_coverage",
      "increase_outfit_readiness",
      "increase_versatility",
      "improve_color_harmony",
      "improve_seasonality",
      "improve_formality_range",
      "reduce_redundancy",
      "reduce_orphan_items",
      "improve_metadata_quality",
      "other",
    ]),
    message: stringSchema(),
  });
}

function buildConfidenceSchema(): JsonSchema {
  return objectSchema({
    overall: numberSchema(),
    lowConfidenceAspects: arrayOf(enumString(CONFIDENCE_ASPECT_VALUES)),
    assumptions: arrayOf(stringSchema()),
  });
}

function buildPersonalItemsReportSchema(): JsonSchema {
  return objectSchema({
    verdict: buildVerdictSchema(),
    scores: buildScoresSchema(),
    personalItemsOverview: buildOverviewSchema(),
    coverage: buildCoverageSchema(),
    outfitReadiness: buildOutfitReadinessSchema(),
    versatility: buildVersatilitySchema(),
    styleProfile: buildStyleProfileSchema(),
    seasonality: buildSeasonalitySchema(),
    colorAnalysis: buildColorAnalysisSchema(),
    efficiency: buildEfficiencySchema(),
    strengths: arrayOf(buildStrengthSchema()),
    issues: arrayOf(buildIssueSchema()),
    suggestions: arrayOf(buildSuggestionSchema()),
    confidence: buildConfidenceSchema(),
  });
}

function buildPersonalItemsReportFormat(): JsonSchemaFormat {
  return {
    type: "json_schema",
    name: "personal_items_report",
    description:
      "Structured report for the user's saved personal wardrobe items.",
    schema: buildPersonalItemsReportSchema(),
    strict: true,
  };
}

export { buildPersonalItemsReportFormat };
