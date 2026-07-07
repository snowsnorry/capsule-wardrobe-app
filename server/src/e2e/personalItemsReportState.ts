import type { E2ePersonalItemsReportSnapshot } from "./stateTypes.js";

function normalizePersonalItemUrls(items: Array<Record<string, unknown>>) {
  return [
    ...new Set(
      items.map((item) => String(item?.url || "").trim()).filter(Boolean),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

export function buildE2ePersonalItemsReport(
  items: Array<Record<string, unknown>>,
  generationNumber: number,
): E2ePersonalItemsReportSnapshot {
  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    personalItemUrls: normalizePersonalItemUrls(items),
    report: {
      schemaVersion: 1,
      generatedAt,
      verdict: {
        score: 0.82,
        status: "good",
        summary: `E2E personal items report #${generationNumber} for ${
          items.length
        } item${items.length === 1 ? "" : "s"}.`,
      },
      scores: {
        coverage: 0.78,
        outfitReadiness: 0.84,
        versatility: 0.8,
        seasonality: 0.86,
      },
    },
  };
}
