import { buildZodSchemaFromJsonSchema } from "./geminiSchema.js";
import { CATEGORY_KEYS } from "./personalItemsReportSchemaValues.js";
import { buildPersonalItemsReportFormat } from "./personalItemsReportSchema.js";
import type { PersonalItemsReportLlmOutput } from "./personalItemsReportTypes.js";

const personalItemsReportZodSchema = buildZodSchemaFromJsonSchema(
  buildPersonalItemsReportFormat().schema,
);
const SUGGESTION_CATEGORIES = new Set<string>(CATEGORY_KEYS);
const CATEGORY_KEY_SET = new Set<string>(CATEGORY_KEYS);

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
  const seen = new Set<string>();
  for (const id of ids) {
    const normalizedId = String(id);
    if (!allowedIds.has(normalizedId)) {
      throw buildInvalidStructuredOutputError(reason);
    }
    if (seen.has(normalizedId)) {
      throw buildInvalidStructuredOutputError(`${reason}_duplicate`);
    }
    seen.add(normalizedId);
  }
}

function assertItemCount(
  report: PersonalItemsReportLlmOutput,
  itemCount: number,
) {
  if (report.personalItemsOverview.itemCount !== itemCount) {
    throw buildInvalidStructuredOutputError("item_count_mismatch");
  }
}

function assertCategoryCountsSum(report: PersonalItemsReportLlmOutput) {
  const total = CATEGORY_KEYS.reduce(
    (sum, key) =>
      sum + Number(report.personalItemsOverview.categoryCounts[key] || 0),
    0,
  );
  if (total !== report.personalItemsOverview.itemCount) {
    throw buildInvalidStructuredOutputError("category_count_mismatch");
  }
}

function buildExpectedCategoryCounts(categories: Array<string | null>) {
  const counts = Object.fromEntries(
    CATEGORY_KEYS.map((key) => [key, 0]),
  ) as PersonalItemsReportLlmOutput["personalItemsOverview"]["categoryCounts"];

  for (const category of categories) {
    const key = String(category || "").trim();
    if (CATEGORY_KEY_SET.has(key)) {
      counts[key as keyof typeof counts] += 1;
    } else {
      counts.other += 1;
    }
  }

  return counts;
}

function normalizeDeterministicOverviewFields(
  report: PersonalItemsReportLlmOutput,
  {
    itemCount,
    itemCategories,
  }: {
    itemCount: number;
    itemCategories?: Array<string | null>;
  },
) {
  report.personalItemsOverview.itemCount = itemCount;
  if (itemCategories) {
    report.personalItemsOverview.categoryCounts =
      buildExpectedCategoryCounts(itemCategories);
  }
}

function assertTemperatureBand(report: PersonalItemsReportLlmOutput) {
  const { min, max } = report.seasonality.temperatureBandC;
  if (min !== null && max !== null && min > max) {
    throw buildInvalidStructuredOutputError("temperature_band_invalid");
  }
}

function assertOutfitRange(report: PersonalItemsReportLlmOutput) {
  const { min, max } = report.outfitReadiness.estimatedOutfitRange;
  if (min !== null && max !== null && min > max) {
    throw buildInvalidStructuredOutputError("outfit_range_invalid");
  }
}

function assertReferencedItemIds(
  report: PersonalItemsReportLlmOutput,
  allowedItemIds: Set<string>,
) {
  for (const cluster of report.styleProfile.styleClusters) {
    assertExactIds(
      cluster.representativeItemIds,
      allowedItemIds,
      "unknown_style_cluster_item_id",
    );
  }
  for (const redundancy of report.efficiency.notableRedundancies) {
    assertExactIds(
      redundancy.itemIds,
      allowedItemIds,
      "unknown_redundancy_item_id",
    );
  }
  for (const orphan of report.efficiency.potentialOrphans) {
    assertExactIds(orphan.itemIds, allowedItemIds, "unknown_orphan_item_id");
  }
  for (const strength of report.strengths) {
    assertExactIds(
      strength.supportingItemIds,
      allowedItemIds,
      "unknown_strength_item_id",
    );
  }
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
}

function assertSuggestionCategories(report: PersonalItemsReportLlmOutput) {
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

function parsePersonalItemsReportLlmOutput(
  value: unknown,
  {
    itemCount,
    itemCategories,
    itemIds,
  }: {
    itemCount: number;
    itemCategories?: Array<string | null>;
    itemIds: string[];
  },
): PersonalItemsReportLlmOutput {
  const report = personalItemsReportZodSchema.parse(
    value,
  ) as PersonalItemsReportLlmOutput;
  const allowedItemIds = new Set(itemIds.map((id) => String(id)));

  normalizeDeterministicOverviewFields(report, { itemCount, itemCategories });
  assertItemCount(report, itemCount);
  assertCategoryCountsSum(report);
  assertTemperatureBand(report);
  assertOutfitRange(report);
  assertReferencedItemIds(report, allowedItemIds);
  assertSuggestionCategories(report);

  return report;
}

export { parsePersonalItemsReportLlmOutput };
