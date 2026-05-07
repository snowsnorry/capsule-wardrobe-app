import {
  AUDIENCE_DISPLAY_ORDER,
  CORE_DISPLAY_ORDER,
  SEARCH_OPTION_ARRAY_FIELDS,
  SEASON_DISPLAY_ORDER,
} from "./searchStateConstants";
import type {
  SearchBrandOption,
  SearchFilterValue,
  SearchOptions,
} from "./searchStateTypes";

export function normalizeBrandOption(
  item: SearchBrandOption | null | undefined,
): { value: string; label: string } | null {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  if (item && typeof item.value === "string") {
    return {
      value: item.value,
      label:
        typeof item.label === "string" && item.label.trim()
          ? item.label
          : item.value,
    };
  }

  return null;
}

export function sortItemsByLabel(
  items: Array<{ value: string; label: string }>,
  locale: string,
): Array<{ value: string; label: string }> {
  return [...items].sort((left, right) =>
    left.label.localeCompare(right.label, locale),
  );
}

function sortByDisplayOrder(
  items: SearchFilterValue[],
  displayOrder: string[],
): SearchFilterValue[] {
  return [...items].sort((left, right) => {
    const leftIndex = displayOrder.indexOf(left);
    const rightIndex = displayOrder.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? displayOrder.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? displayOrder.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

export function sortCoreValues(
  items: SearchFilterValue[],
): SearchFilterValue[] {
  return sortByDisplayOrder(items, CORE_DISPLAY_ORDER);
}

export function sortSeasonValues(
  items: SearchFilterValue[],
): SearchFilterValue[] {
  return sortByDisplayOrder(items, SEASON_DISPLAY_ORDER);
}

export function sortAudienceValues(
  items: SearchFilterValue[],
): SearchFilterValue[] {
  return sortByDisplayOrder(items, AUDIENCE_DISPLAY_ORDER);
}

export function buildSearchOptionsPayload(
  optionsResponse: Partial<SearchOptions> = {},
): SearchOptions {
  const arrayOptions = Object.fromEntries(
    SEARCH_OPTION_ARRAY_FIELDS.map((field) => [
      field,
      optionsResponse[field] || [],
    ]),
  ) as Pick<SearchOptions, (typeof SEARCH_OPTION_ARRAY_FIELDS)[number]>;

  return {
    ...arrayOptions,
    priceRange: optionsResponse.priceRange || { min: null, max: null },
  };
}
