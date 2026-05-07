import type { CountByKey } from "./types.js";

export function formatProfileValues(values: string[] | null | undefined) {
  if (!Array.isArray(values) || values.length === 0) {
    return "Not specified";
  }

  const formatted = values.filter(
    (value) => typeof value === "string" && value.trim().length > 0,
  );
  if (formatted.length === 0) {
    return "Not specified";
  }

  return formatted.join(", ");
}

export function getCategoryListText(categories: CountByKey) {
  return Object.entries(categories)
    .filter(([, count]) => Number.isInteger(count) && count > 0)
    .map(([category, count]) => `${count} ${category}`)
    .join(", ");
}

export function getCategorySchema(categories: CountByKey) {
  const schema = Object.entries(categories).reduce<Record<string, string[]>>(
    (result, [category, count]) => {
      if (!Number.isInteger(count) || count <= 0) {
        return result;
      }

      result[category] = Array.from(
        { length: Number(count) },
        (_, index) => `id${index + 1}`,
      );
      return result;
    },
    {},
  );

  return JSON.stringify(schema, null, 4);
}

export function getSelectedIdsFromCapsule(capsule) {
  if (!capsule || typeof capsule !== "object" || Array.isArray(capsule)) {
    return [];
  }

  return Object.values(capsule).flatMap((ids) => {
    if (!Array.isArray(ids)) {
      return [];
    }

    return ids.map((id) => String(id)).filter((id) => id.trim().length > 0);
  });
}

export function getShortCapsuleName(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeCapsuleConstraintValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizePatternValue(value) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : null;
}

export function getNormalizedItemStyles(item) {
  if (!Array.isArray(item?.style)) {
    return [];
  }

  return item.style
    .filter((style) => typeof style === "string" && style.trim().length > 0)
    .map((style) => style.trim());
}

export function getFirstNonMinimalisticStyle(item) {
  return (
    getNormalizedItemStyles(item).find((style) => style !== "minimalistic") ||
    null
  );
}
