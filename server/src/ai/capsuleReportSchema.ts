/* eslint-disable max-lines */
import type { JsonSchema, JsonSchemaFormat } from "./types.js";

const CATEGORY_KEYS = [
  "top",
  "bottom",
  "midlayer",
  "outerwear",
  "dress",
  "shoes",
  "bag",
  "belt",
  "swimwear",
  "other",
] as const;
const SEVERITY_VALUES = ["info", "warning", "critical"];
const COVERAGE_LEVEL_VALUES = [
  "missing",
  "thin",
  "adequate",
  "strong",
  "overrepresented",
];
const SEASON_VALUES = ["spring", "summer", "autumn", "winter"];
const WEATHER_VALUES = [
  "dry",
  "light_rain",
  "rain",
  "windy",
  "hot",
  "warm",
  "cool",
  "cold",
  "snow",
  "indoor",
  "unknown",
];
const FORMALITY_VALUES = ["casual", "smart_casual", "formal"];
const STYLE_VALUES = [
  "minimalistic",
  "street_style",
  "romantic",
  "preppy",
  "retro",
  "boho",
  "nautical",
  "safari",
  "equestrian",
  "military",
  "grunge",
  "sporty",
  "mixed",
  "unclear",
];
const COLOR_VALUES = [
  "black",
  "white",
  "grey",
  "brown",
  "beige",
  "light_blue",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "yellow",
  "orange",
  "metallic",
  "multicolor",
  "burgundy",
  "khaki",
  "navy",
  "denim",
];

function enumString(
  values: readonly string[],
  description?: string,
): JsonSchema {
  return {
    type: "string",
    enum: [...values],
    ...(description ? { description } : {}),
  };
}

function nullableEnumString(
  values: readonly string[],
  description?: string,
): JsonSchema {
  return {
    type: ["string", "null"],
    enum: [...values, null],
    ...(description ? { description } : {}),
  };
}

function stringSchema(description?: string): JsonSchema {
  return {
    type: "string",
    ...(description ? { description } : {}),
  };
}

function nullableString(description?: string): JsonSchema {
  return {
    type: ["string", "null"],
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

function categorySchema(): JsonSchema {
  return enumString(CATEGORY_KEYS);
}

function nullableCategorySchema(): JsonSchema {
  return nullableEnumString(CATEGORY_KEYS);
}

function severitySchema(): JsonSchema {
  return enumString(SEVERITY_VALUES);
}

function buildScoredVerdictNoteSchema(): JsonSchema {
  return objectSchema({
    score: numberSchema(),
    verdict: enumString(["strong", "acceptable", "weak", "unclear"]),
    notes: stringSchema(),
  });
}

function buildCategoryCountsSchema(): JsonSchema {
  return objectSchema(
    Object.fromEntries(
      CATEGORY_KEYS.map((category) => [category, integerSchema()]),
    ),
    [...CATEGORY_KEYS],
  );
}

function buildVerdictSchema(): JsonSchema {
  return objectSchema({
    status: enumString([
      "excellent",
      "good",
      "usable_with_gaps",
      "off_target",
      "incomplete",
      "incoherent",
    ]),
    score: numberSchema("Overall capsule quality score from 0 to 1."),
    summary: stringSchema("One concise user-facing verdict sentence."),
  });
}

function buildCapsuleSummarySchema(): JsonSchema {
  return objectSchema({
    itemCount: integerSchema("Total number of capsule items."),
    categoryCounts: buildCategoryCountsSchema(),
    detectedCategoryBalance: enumString([
      "balanced",
      "top_heavy",
      "bottom_heavy",
      "outerwear_heavy",
      "shoe_limited",
      "accessory_heavy",
      "unclear",
    ]),
    capsuleType: enumString(["minimal", "compact", "expanded", "overbuilt"]),
    summaryTags: arrayOf(stringSchema()),
  });
}

function buildTargetAlignmentSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    audienceFit: buildScoredVerdictNoteSchema(),
    occasionFit: objectSchema({
      score: numberSchema(),
      matchedOccasions: arrayOf(stringSchema()),
      weakOccasions: arrayOf(stringSchema()),
      notes: stringSchema(),
    }),
    formalityFit: objectSchema({
      score: numberSchema(),
      detectedRange: arrayOf(enumString(FORMALITY_VALUES)),
      targetMatched: { type: "boolean" },
      notes: stringSchema(),
    }),
    styleFit: objectSchema({
      score: numberSchema(),
      primaryDetectedStyle: enumString(STYLE_VALUES),
      secondaryDetectedStyles: arrayOf(enumString(STYLE_VALUES)),
      targetMatched: { type: "boolean" },
      notes: stringSchema(),
    }),
    accentColorFit: objectSchema({
      score: numberSchema(),
      targetAccentColor: nullableString(),
      presentAs: enumString([
        "dominant",
        "accent",
        "minor_detail",
        "absent",
        "unclear",
      ]),
      notes: stringSchema(),
    }),
    patternFit: objectSchema({
      score: numberSchema(),
      targetPattern: nullableString(),
      verdict: enumString([
        "matched",
        "compatible",
        "underused",
        "overused",
        "conflicting",
        "not_applicable",
        "unclear",
      ]),
      notes: stringSchema(),
    }),
    additionalInfoFit: objectSchema({
      score: numberSchema(),
      interpretedRequirements: arrayOf(stringSchema()),
      unmetRequirements: arrayOf(stringSchema()),
      notes: stringSchema(),
    }),
  });
}

function buildCoverageSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    coreRoleCoverage: objectSchema({
      tops: enumString(COVERAGE_LEVEL_VALUES),
      bottoms: enumString(COVERAGE_LEVEL_VALUES),
      shoes: enumString(COVERAGE_LEVEL_VALUES),
      layers: enumString(COVERAGE_LEVEL_VALUES),
      accessories: enumString(COVERAGE_LEVEL_VALUES),
    }),
    missingCategories: arrayOf(categorySchema()),
    weakCategories: arrayOf(categorySchema()),
    overrepresentedCategories: arrayOf(categorySchema()),
    bottlenecks: arrayOf(
      objectSchema({
        category: categorySchema(),
        severity: severitySchema(),
        message: stringSchema(),
      }),
    ),
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
    ]),
    primaryOutfitModes: arrayOf(
      enumString([
        "everyday",
        "layered",
        "smart_casual",
        "warm_weather",
        "cool_weather",
        "statement",
        "minimal",
        "travel",
        "office",
        "evening",
      ]),
    ),
    limitingFactors: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildCohesionSchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    styleCoherence: numberSchema(),
    formalityCoherence: numberSchema(),
    silhouetteCoherence: numberSchema(),
    materialCoherence: numberSchema(),
    colorCoherence: numberSchema(),
    mainStrengths: arrayOf(stringSchema()),
    mainRisks: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildSeasonalitySchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema(),
    primarySeasons: arrayOf(enumString(SEASON_VALUES)),
    secondarySeasons: arrayOf(enumString(SEASON_VALUES)),
    temperatureBandC: objectSchema({
      min: { type: ["number", "null"] },
      max: { type: ["number", "null"] },
    }),
    layeringSupport: enumString(["none", "limited", "moderate", "strong"]),
    weatherSuitability: arrayOf(enumString(WEATHER_VALUES)),
    weatherLimitations: arrayOf(stringSchema()),
    notes: stringSchema(),
  });
}

function buildColorAnalysisSchema(): JsonSchema {
  return objectSchema({
    paletteType: enumString([
      "neutral",
      "muted_neutral",
      "tonal",
      "high_contrast",
      "color_blocked",
      "mixed",
      "unclear",
    ]),
    baseColors: arrayOf(enumString(COLOR_VALUES)),
    accentColors: arrayOf(enumString(COLOR_VALUES)),
    targetAccentColor: nullableString(),
    accentColorUsage: enumString([
      "absent",
      "subtle",
      "balanced",
      "dominant",
      "overused",
      "unclear",
    ]),
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
    colorScore: numberSchema(),
    notes: stringSchema(),
  });
}

function buildGeneratedOutfitAssessmentSchema(): JsonSchema {
  return objectSchema({
    providedOutfitCount: integerSchema(),
    overallScore: numberSchema(),
    completeOutfitCount: integerSchema(),
    weakOutfitCount: integerSchema(),
    varietyScore: numberSchema(),
    targetFitScore: numberSchema(),
    roleCoverageScore: numberSchema(),
    repetitionScore: numberSchema(),
    strongestOutfitRefs: arrayOf(stringSchema()),
    weakOutfits: arrayOf(
      objectSchema({
        outfitId: stringSchema(),
        severity: severitySchema(),
        issue: stringSchema(),
        affectedItemIds: arrayOf(stringSchema()),
        suggestion: stringSchema(),
      }),
    ),
    notes: stringSchema(),
  });
}

function buildIssueSchema(): JsonSchema {
  return objectSchema({
    code: stringSchema(),
    severity: severitySchema(),
    dimension: enumString([
      "target_alignment",
      "coverage",
      "versatility",
      "cohesion",
      "seasonality",
      "style",
      "color",
      "formality",
      "practicality",
      "generated_outfits",
      "confidence",
    ]),
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
      "keep",
      "style",
    ]),
    priority: enumString(["low", "medium", "high"]),
    targetItemIds: arrayOf(stringSchema()),
    targetCategory: nullableCategorySchema(),
    replacementCategory: nullableCategorySchema(),
    replacementDescription: nullableString(),
    expectedImpact: enumString([
      "improve_target_fit",
      "increase_versatility",
      "improve_color_harmony",
      "improve_seasonality",
      "improve_formality_range",
      "reduce_noise",
      "other",
    ]),
    message: stringSchema(),
  });
}

function buildConfidenceSchema(): JsonSchema {
  return objectSchema({
    overall: numberSchema(),
    lowConfidenceAspects: arrayOf(
      enumString([
        "material_weight",
        "exact_fit",
        "color_accuracy",
        "image_quality",
        "item_metadata",
        "weather_protection",
        "warmth_level",
        "occasion_suitability",
        "style_interpretation",
        "outfit_combinations",
        "user_additional_requirements",
        "unknown",
      ]),
    ),
    assumptions: arrayOf(stringSchema()),
  });
}

function buildCapsuleReportSchema(): JsonSchema {
  return objectSchema({
    verdict: buildVerdictSchema(),
    capsuleSummary: buildCapsuleSummarySchema(),
    targetAlignment: buildTargetAlignmentSchema(),
    coverage: buildCoverageSchema(),
    versatility: buildVersatilitySchema(),
    cohesion: buildCohesionSchema(),
    seasonality: buildSeasonalitySchema(),
    colorAnalysis: buildColorAnalysisSchema(),
    generatedOutfitAssessment: buildGeneratedOutfitAssessmentSchema(),
    issues: arrayOf(buildIssueSchema()),
    suggestions: arrayOf(buildSuggestionSchema()),
    confidence: buildConfidenceSchema(),
  });
}

function buildCapsuleReportFormat(): JsonSchemaFormat {
  return {
    type: "json_schema",
    name: "capsule_report",
    description: "Structured report for an already generated capsule wardrobe.",
    schema: buildCapsuleReportSchema(),
    strict: true,
  };
}

export { CATEGORY_KEYS, buildCapsuleReportFormat };
