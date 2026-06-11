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
const ROLE_VALUES = [
  "base_top",
  "mid_layer",
  "outer_layer",
  "bottom",
  "dress_one_piece",
  "footwear",
  "waist_accessory",
  "bag",
  "swimwear",
  "other_accessory",
  "unknown",
];
const CORE_ROLE_VALUES = ["base_top", "bottom", "dress_one_piece", "footwear"];
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
];
const OCCASION_VALUES = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "everyday_errands",
];
const COLOR_VALUES = [
  "black",
  "white",
  "grey",
  "brown",
  "beige",
  "light blue",
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
const CONFIDENCE_ASPECT_VALUES = [
  "material_weight",
  "exact_fit",
  "color_accuracy",
  "image_quality",
  "item_metadata",
  "weather_protection",
  "warmth_level",
  "occasion_suitability",
  "style_interpretation",
  "unknown",
];

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

function buildVerdictSchema(): JsonSchema {
  return objectSchema({
    status: enumString([
      "valid",
      "acceptable_with_notes",
      "incomplete",
      "incoherent",
    ]),
    score: numberSchema("Overall outfit quality score from 0 to 1."),
    summary: stringSchema("One concise user-facing verdict sentence."),
  });
}

function buildCompositionSchema(): JsonSchema {
  return objectSchema({
    itemCount: integerSchema("Total number of outfit items."),
    categoryCounts: buildCategoryCountsSchema(),
    detectedRoles: arrayOf(enumString(ROLE_VALUES)),
    missingCoreRoles: arrayOf(enumString(CORE_ROLE_VALUES)),
    extraRoles: arrayOf(enumString(ROLE_VALUES)),
    completeness: enumString(["complete", "partial", "overbuilt"]),
  });
}

function buildSeasonalitySchema(): JsonSchema {
  return objectSchema({
    primarySeasons: arrayOf(enumString(SEASON_VALUES)),
    secondarySeasons: arrayOf(enumString(SEASON_VALUES)),
    temperatureBandC: objectSchema({
      min: { type: ["number", "null"] },
      max: { type: ["number", "null"] },
    }),
    weatherSuitability: arrayOf(enumString(WEATHER_VALUES)),
    weatherLimitations: arrayOf(stringSchema()),
    seasonScore: numberSchema("Seasonal coherence score from 0 to 1."),
  });
}

function buildStyleProfileSchema(): JsonSchema {
  return objectSchema({
    primaryStyle: enumString([...STYLE_VALUES, "mixed", "unclear"]),
    secondaryStyles: arrayOf(enumString(STYLE_VALUES)),
    formalityLevel: enumString(["casual", "smart_casual", "formal"]),
    occasions: arrayOf(enumString(OCCASION_VALUES)),
    styleKeywords: arrayOf(stringSchema()),
    styleScore: numberSchema("Style coherence score from 0 to 1."),
  });
}

function buildCompatibilitySchema(): JsonSchema {
  return objectSchema({
    overallScore: numberSchema("Overall compatibility score from 0 to 1."),
    styleCoherence: numberSchema("Style consistency score from 0 to 1."),
    formalityCoherence: numberSchema(
      "Dress-code consistency score from 0 to 1.",
    ),
    seasonalCoherence: numberSchema(
      "Weather and season consistency score from 0 to 1.",
    ),
    colorCoherence: numberSchema("Palette harmony score from 0 to 1."),
    mainStrengths: arrayOf(stringSchema()),
    mainRisks: arrayOf(stringSchema()),
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
    dominantColors: arrayOf(enumString(COLOR_VALUES)),
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
    colorScore: numberSchema("Color coherence score from 0 to 1."),
    notes: stringSchema("Concise explanation of the outfit palette."),
  });
}

function buildIssueSchema(): JsonSchema {
  return objectSchema({
    code: stringSchema("Stable SCREAMING_SNAKE_CASE issue code."),
    severity: enumString(["info", "warning", "critical"]),
    dimension: enumString([
      "composition",
      "seasonality",
      "style",
      "color",
      "formality",
      "practicality",
      "confidence",
    ]),
    message: stringSchema("Concise user-facing issue."),
    affectedItemIds: arrayOf(stringSchema()),
    suggestion: stringSchema("Concise suggestion for the issue."),
  });
}

function buildSuggestionSchema(): JsonSchema {
  return objectSchema({
    type: enumString(["add", "remove", "replace", "keep", "adjust"]),
    priority: enumString(["low", "medium", "high"]),
    targetItemIds: arrayOf(stringSchema()),
    replacementCategory: nullableString(
      "Replacement category for add/replace suggestions, otherwise null.",
    ),
    replacementDescription: nullableString(
      "Plain English replacement description, otherwise null.",
    ),
    message: stringSchema("Concise user-facing suggestion."),
  });
}

function buildConfidenceSchema(): JsonSchema {
  return objectSchema({
    overall: numberSchema("Overall report confidence from 0 to 1."),
    lowConfidenceAspects: arrayOf(enumString(CONFIDENCE_ASPECT_VALUES)),
    assumptions: arrayOf(stringSchema()),
  });
}

function buildOutfitReportSchema(): JsonSchema {
  return objectSchema({
    verdict: buildVerdictSchema(),
    composition: buildCompositionSchema(),
    seasonality: buildSeasonalitySchema(),
    styleProfile: buildStyleProfileSchema(),
    compatibility: buildCompatibilitySchema(),
    colorAnalysis: buildColorAnalysisSchema(),
    issues: arrayOf(buildIssueSchema()),
    suggestions: arrayOf(buildSuggestionSchema()),
    confidence: buildConfidenceSchema(),
  });
}

function buildOutfitReportFormat(): JsonSchemaFormat {
  return {
    type: "json_schema",
    name: "outfit_report",
    description:
      "Structured outfit report for a single already assembled outfit.",
    schema: buildOutfitReportSchema(),
    strict: true,
  };
}

export { CATEGORY_KEYS, buildOutfitReportFormat };
