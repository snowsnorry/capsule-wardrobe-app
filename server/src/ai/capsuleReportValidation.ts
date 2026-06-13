import { buildZodSchemaFromJsonSchema } from "./geminiSchema.js";
import {
  CATEGORY_KEYS,
  buildCapsuleReportFormat,
} from "./capsuleReportSchema.js";
import type { CapsuleReportLlmOutput } from "./capsuleReportTypes.js";

const capsuleReportZodSchema = buildZodSchemaFromJsonSchema(
  buildCapsuleReportFormat().schema,
);
const SUGGESTION_CATEGORIES = new Set<string>(CATEGORY_KEYS);

function buildInvalidStructuredOutputError(reason: string) {
  const error = new Error(`invalid_structured_output:${reason}`) as Error & {
    code?: string;
  };
  error.code = "invalid_structured_output";
  return error;
}

function assertExactIds(
  ids: string[] = [],
  allowedIds: Set<string>,
  reason: string,
) {
  for (const id of ids) {
    if (!allowedIds.has(String(id))) {
      throw buildInvalidStructuredOutputError(reason);
    }
  }
}

function assertItemCount(report: CapsuleReportLlmOutput, itemCount: number) {
  if (report.capsuleSummary.itemCount !== itemCount) {
    throw buildInvalidStructuredOutputError("item_count_mismatch");
  }
}

function assertCategoryCountsSum(report: CapsuleReportLlmOutput) {
  const total = CATEGORY_KEYS.reduce(
    (sum, key) => sum + Number(report.capsuleSummary.categoryCounts[key] || 0),
    0,
  );
  if (total !== report.capsuleSummary.itemCount) {
    throw buildInvalidStructuredOutputError("category_count_mismatch");
  }
}

function assertTemperatureBand(report: CapsuleReportLlmOutput) {
  const { min, max } = report.seasonality.temperatureBandC;
  if (min !== null && max !== null && min > max) {
    throw buildInvalidStructuredOutputError("temperature_band_invalid");
  }
}

function assertSeasonSets(report: CapsuleReportLlmOutput) {
  const primarySeasons = new Set(report.seasonality.primarySeasons);
  for (const season of report.seasonality.secondarySeasons) {
    if (primarySeasons.has(season)) {
      throw buildInvalidStructuredOutputError("season_overlap");
    }
  }
}

function assertReferencedItemIds(
  report: CapsuleReportLlmOutput,
  allowedItemIds: Set<string>,
) {
  for (const issue of report.issues) {
    assertExactIds(
      issue.affectedItemIds,
      allowedItemIds,
      "unknown_issue_item_id",
    );
  }
  for (const suggestion of report.suggestions) {
    assertExactIds(
      suggestion.targetItemIds,
      allowedItemIds,
      "unknown_suggestion_item_id",
    );
  }
  for (const weakOutfit of report.generatedOutfitAssessment.weakOutfits) {
    assertExactIds(
      weakOutfit.affectedItemIds,
      allowedItemIds,
      "unknown_weak_outfit_item_id",
    );
  }
}

function assertSuggestionCategories(report: CapsuleReportLlmOutput) {
  for (const suggestion of report.suggestions) {
    for (const category of [
      suggestion.targetCategory,
      suggestion.replacementCategory,
    ]) {
      if (category !== null && !SUGGESTION_CATEGORIES.has(category)) {
        throw buildInvalidStructuredOutputError("unknown_suggestion_category");
      }
    }
  }
}

function assertGeneratedOutfitRefs(
  report: CapsuleReportLlmOutput,
  allowedOutfitIds: Set<string>,
) {
  assertExactIds(
    report.generatedOutfitAssessment.strongestOutfitRefs,
    allowedOutfitIds,
    "unknown_generated_outfit_ref",
  );
  for (const weakOutfit of report.generatedOutfitAssessment.weakOutfits) {
    if (!allowedOutfitIds.has(String(weakOutfit.outfitId))) {
      throw buildInvalidStructuredOutputError("unknown_weak_outfit_ref");
    }
  }
}

function parseCapsuleReportLlmOutput(
  value: unknown,
  {
    generatedOutfitIds,
    itemCount,
    itemIds,
  }: {
    generatedOutfitIds: string[];
    itemCount: number;
    itemIds: string[];
  },
): CapsuleReportLlmOutput {
  const report = capsuleReportZodSchema.parse(value) as CapsuleReportLlmOutput;
  const allowedItemIds = new Set(itemIds.map((id) => String(id)));
  const allowedOutfitIds = new Set(generatedOutfitIds.map((id) => String(id)));

  assertItemCount(report, itemCount);
  assertCategoryCountsSum(report);
  assertTemperatureBand(report);
  assertSeasonSets(report);
  assertReferencedItemIds(report, allowedItemIds);
  assertSuggestionCategories(report);
  assertGeneratedOutfitRefs(report, allowedOutfitIds);

  return report;
}

export { parseCapsuleReportLlmOutput };
