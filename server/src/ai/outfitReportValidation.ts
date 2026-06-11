import { buildZodSchemaFromJsonSchema } from "./geminiSchema.js";
import {
  CATEGORY_KEYS,
  buildOutfitReportFormat,
} from "./outfitReportSchema.js";
import type { OutfitReportLlmOutput } from "./outfitReportTypes.js";

const outfitReportZodSchema = buildZodSchemaFromJsonSchema(
  buildOutfitReportFormat().schema,
);
const SUGGESTION_REPLACEMENT_CATEGORIES = new Set<string>(CATEGORY_KEYS);

function buildInvalidStructuredOutputError(reason: string) {
  const error = new Error(`invalid_structured_output:${reason}`) as Error & {
    code?: string;
  };
  error.code = "invalid_structured_output";
  return error;
}

function assertExactItemIds(
  ids: string[] = [],
  allowedItemIds: Set<string>,
  reason: string,
) {
  for (const id of ids) {
    if (!allowedItemIds.has(String(id))) {
      throw buildInvalidStructuredOutputError(reason);
    }
  }
}

function assertCategoryCountsSum(report: OutfitReportLlmOutput) {
  const total = CATEGORY_KEYS.reduce(
    (sum, key) => sum + Number(report.composition.categoryCounts[key] || 0),
    0,
  );
  if (total !== report.composition.itemCount) {
    throw buildInvalidStructuredOutputError("category_count_mismatch");
  }
}

function assertTemperatureBand(report: OutfitReportLlmOutput) {
  const { min, max } = report.seasonality.temperatureBandC;
  if (min !== null && max !== null && min > max) {
    throw buildInvalidStructuredOutputError("temperature_band_invalid");
  }
}

function assertItemCount(report: OutfitReportLlmOutput, itemCount: number) {
  if (report.composition.itemCount !== itemCount) {
    throw buildInvalidStructuredOutputError("item_count_mismatch");
  }
}

function assertReferencedItemIds(
  report: OutfitReportLlmOutput,
  allowedItemIds: Set<string>,
) {
  for (const issue of report.issues) {
    assertExactItemIds(
      issue.affectedItemIds,
      allowedItemIds,
      "unknown_issue_item_id",
    );
  }
  for (const suggestion of report.suggestions) {
    assertExactItemIds(
      suggestion.targetItemIds,
      allowedItemIds,
      "unknown_suggestion_item_id",
    );
  }
}

function assertSuggestionCategories(report: OutfitReportLlmOutput) {
  for (const suggestion of report.suggestions) {
    if (
      suggestion.replacementCategory !== null &&
      !SUGGESTION_REPLACEMENT_CATEGORIES.has(suggestion.replacementCategory)
    ) {
      throw buildInvalidStructuredOutputError("unknown_replacement_category");
    }
  }
}

function parseOutfitReportLlmOutput(
  value: unknown,
  {
    itemCount,
    itemIds,
  }: {
    itemCount: number;
    itemIds: string[];
  },
): OutfitReportLlmOutput {
  const report = outfitReportZodSchema.parse(value) as OutfitReportLlmOutput;
  const allowedItemIds = new Set(itemIds.map((id) => String(id)));

  assertItemCount(report, itemCount);
  assertCategoryCountsSum(report);
  assertTemperatureBand(report);
  assertReferencedItemIds(report, allowedItemIds);
  assertSuggestionCategories(report);

  return report;
}

export { parseOutfitReportLlmOutput };
