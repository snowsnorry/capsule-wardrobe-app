type SearchFilterValue = string;
type SearchBrandOption = string | { value: string; label?: string };

type SearchPriceRange = {
  min: number | null;
  max: number | null;
};

type SearchOptions = {
  brands: SearchBrandOption[];
  categories: SearchFilterValue[];
  seasons: SearchFilterValue[];
  formalityLevels: SearchFilterValue[];
  styles: SearchFilterValue[];
  occasions: SearchFilterValue[];
  audience: SearchFilterValue[];
  colors: SearchFilterValue[];
  patterns: SearchFilterValue[];
  silhouettes: SearchFilterValue[];
  fits: SearchFilterValue[];
  closureTypes: SearchFilterValue[];
  priceRange: SearchPriceRange;
};

type SearchState = {
  query: string;
  brand: SearchFilterValue[];
  priceMin: number | null;
  priceMax: number | null;
  audience: SearchFilterValue[];
  category: SearchFilterValue[];
  season: SearchFilterValue[];
  formalityLevel: SearchFilterValue[];
  style: SearchFilterValue[];
  occasions: SearchFilterValue[];
  color: SearchFilterValue[];
  pattern: SearchFilterValue[];
  silhouette: SearchFilterValue[];
  fit: SearchFilterValue[];
  closureType: SearchFilterValue[];
  page: number;
};

type SearchStateSource = Omit<
  SearchState,
  | "brand"
  | "audience"
  | "category"
  | "season"
  | "formalityLevel"
  | "style"
  | "occasions"
  | "color"
  | "pattern"
  | "silhouette"
  | "fit"
  | "closureType"
> & {
  brand?: SearchFilterValue | SearchFilterValue[];
  audience?: SearchFilterValue | SearchFilterValue[];
  category?: SearchFilterValue | SearchFilterValue[];
  season?: SearchFilterValue | SearchFilterValue[];
  formalityLevel?: SearchFilterValue | SearchFilterValue[];
  style?: SearchFilterValue | SearchFilterValue[];
  occasions?: SearchFilterValue | SearchFilterValue[];
  color?: SearchFilterValue | SearchFilterValue[];
  pattern?: SearchFilterValue | SearchFilterValue[];
  silhouette?: SearchFilterValue | SearchFilterValue[];
  fit?: SearchFilterValue | SearchFilterValue[];
  closureType?: SearchFilterValue | SearchFilterValue[];
};
type SearchArrayField = keyof Pick<
  SearchState,
  | "brand"
  | "audience"
  | "category"
  | "season"
  | "formalityLevel"
  | "style"
  | "occasions"
  | "color"
  | "pattern"
  | "silhouette"
  | "fit"
  | "closureType"
>;

type SearchDraftState = SearchState & {
  priceEnabled: boolean;
  priceMinDraft: number | string;
  priceMaxDraft: number | string;
};

type SerializedSearchState = SearchState;

type SearchTranslator = (
  key: string,
  params?: Record<string, unknown>,
) => string;

type ActiveFilterChip = {
  key: string;
  field: keyof SearchDraftState | "price";
  values?: string[];
  value?: string;
  label: string;
};

const INITIAL_SEARCH_STATE = Object.freeze({
  query: "",
  brand: [],
  priceMin: null,
  priceMax: null,
  audience: [],
  category: [],
  season: [],
  formalityLevel: [],
  style: [],
  occasions: [],
  color: [],
  pattern: [],
  silhouette: [],
  fit: [],
  closureType: [],
  page: 1,
}) satisfies SearchState;

const CORE_DISPLAY_ORDER = ["casual", "smart_casual", "formal"];
const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];
const AUDIENCE_DISPLAY_ORDER = ["woman", "man", "all"];

const EMPTY_SEARCH_OPTIONS = Object.freeze({
  brands: [],
  categories: [],
  seasons: [],
  formalityLevels: [],
  styles: [],
  occasions: [],
  audience: [],
  colors: [],
  patterns: [],
  silhouettes: [],
  fits: [],
  closureTypes: [],
  priceRange: { min: null, max: null },
}) satisfies SearchOptions;

const SEARCH_ARRAY_FIELDS: readonly SearchArrayField[] = [
  "brand",
  "audience",
  "category",
  "season",
  "formalityLevel",
  "style",
  "occasions",
  "color",
  "pattern",
  "silhouette",
  "fit",
  "closureType",
];

const SEARCH_OPTION_ARRAY_FIELDS = [
  "brands",
  "categories",
  "seasons",
  "formalityLevels",
  "styles",
  "occasions",
  "audience",
  "colors",
  "patterns",
  "silhouettes",
  "fits",
  "closureTypes",
] as const;

function normalizeSearchArrayValue(
  value: SearchFilterValue | SearchFilterValue[] | undefined,
): SearchFilterValue[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

function createSearchState(
  savedSearch: Partial<SearchStateSource> | null | undefined,
  priceRange: SearchPriceRange,
): SearchDraftState {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  const normalizedArrays = Object.fromEntries(
    SEARCH_ARRAY_FIELDS.map((field) => [
      field,
      normalizeSearchArrayValue(base[field]),
    ]),
  ) as Pick<SearchState, SearchArrayField>;

  return {
    ...base,
    ...normalizedArrays,
    priceEnabled: hasPriceBounds,
    priceMinDraft: hasPriceBounds
      ? (base.priceMin ?? priceRange.min ?? 0)
      : (priceRange.min ?? 0),
    priceMaxDraft: hasPriceBounds
      ? (base.priceMax ?? priceRange.max ?? 0)
      : (priceRange.max ?? 0),
  };
}

function clampPriceValue(
  value: number | string | null | undefined,
  min: number,
  max: number,
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(Math.max(parsed, min), max);
}

function serializeDraftState(state: SearchDraftState): SerializedSearchState {
  return {
    query: state.query,
    brand: state.brand,
    priceMin: state.priceEnabled ? Number(state.priceMinDraft) : null,
    priceMax: state.priceEnabled ? Number(state.priceMaxDraft) : null,
    audience: state.audience,
    category: state.category,
    season: state.season,
    formalityLevel: state.formalityLevel,
    style: state.style,
    occasions: state.occasions,
    color: state.color,
    pattern: state.pattern,
    silhouette: state.silhouette,
    fit: state.fit,
    closureType: state.closureType,
    page: state.page,
  };
}

function toggleSelection(
  value: SearchFilterValue,
  selected: SearchFilterValue[],
): SearchFilterValue[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function normalizeBrandOption(
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

function sortItemsByLabel(
  items: Array<{ value: string; label: string }>,
  locale: string,
): Array<{ value: string; label: string }> {
  return [...items].sort((left, right) =>
    left.label.localeCompare(right.label, locale),
  );
}

function sortCoreValues(items: SearchFilterValue[]): SearchFilterValue[] {
  return [...items].sort((left, right) => {
    const leftIndex = CORE_DISPLAY_ORDER.indexOf(left);
    const rightIndex = CORE_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft =
      leftIndex === -1 ? CORE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? CORE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function sortSeasonValues(items: SearchFilterValue[]): SearchFilterValue[] {
  return [...items].sort((left, right) => {
    const leftIndex = SEASON_DISPLAY_ORDER.indexOf(left);
    const rightIndex = SEASON_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft =
      leftIndex === -1 ? SEASON_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? SEASON_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function sortAudienceValues(items: SearchFilterValue[]): SearchFilterValue[] {
  return [...items].sort((left, right) => {
    const leftIndex = AUDIENCE_DISPLAY_ORDER.indexOf(left);
    const rightIndex = AUDIENCE_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft =
      leftIndex === -1 ? AUDIENCE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? AUDIENCE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function buildSearchOptionsPayload(
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

function formatSearchPrice(locale: string, value: number): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function getFacetLabel({
  value,
  optionGroup,
  options,
  locale,
  translateOption,
}: {
  value: string;
  optionGroup: string;
  options: SearchOptions;
  locale: string;
  translateOption: (group: string, value: string, locale: string) => string;
}): string {
  if (value === "__other__") {
    return "Other";
  }

  if (optionGroup === "brand") {
    const normalizedSelectedValue = String(value || "")
      .trim()
      .toLowerCase();
    const brand = options.brands.find((item) => {
      const normalizedValue = typeof item === "string" ? item : item?.value;
      return (
        String(normalizedValue || "")
          .trim()
          .toLowerCase() === normalizedSelectedValue
      );
    });
    if (typeof brand === "string") {
      return brand;
    }
    if (brand?.label) {
      return brand.label;
    }
    return value;
  }

  return translateOption(optionGroup, value, locale);
}

function buildActiveFilterChips({
  state,
  options,
  locale,
  t,
  translateOption,
}: {
  state: SearchDraftState;
  options: SearchOptions;
  locale: string;
  t: SearchTranslator;
  translateOption: (group: string, value: string, locale: string) => string;
}): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  const pushFacetChips = (
    values: string[],
    title: string,
    optionGroup: string,
    fieldKey: keyof SearchDraftState,
  ) => {
    if (!Array.isArray(values) || values.length === 0) {
      return;
    }

    const labelValues = values.map((value) =>
      getFacetLabel({
        value,
        optionGroup,
        options,
        locale,
        translateOption,
      }),
    );

    chips.push({
      key: `${fieldKey}:${values.join(",")}`,
      field: fieldKey,
      values,
      label: `${title}: ${labelValues.join(", ")}`,
    });
  };

  pushFacetChips(state.brand, t("search.filters.brand"), "brand", "brand");
  pushFacetChips(
    state.audience,
    t("profile.audienceTitle"),
    "audience",
    "audience",
  );
  pushFacetChips(
    state.category,
    t("search.filters.category"),
    "categories",
    "category",
  );
  pushFacetChips(state.season, t("profile.seasonsTitle"), "seasons", "season");
  pushFacetChips(
    state.formalityLevel,
    t("statistics.charts.formalityLevel"),
    "styles",
    "formalityLevel",
  );
  pushFacetChips(state.style, t("statistics.charts.style"), "styles", "style");
  pushFacetChips(
    state.occasions,
    t("profile.occasionsTitle"),
    "occasions",
    "occasions",
  );
  pushFacetChips(
    state.color,
    t("profile.accentColorTitle"),
    "accentColors",
    "color",
  );
  pushFacetChips(
    state.pattern,
    t("profile.patternTitle"),
    "patterns",
    "pattern",
  );
  pushFacetChips(
    state.silhouette,
    t("search.filters.silhouette"),
    "silhouettes",
    "silhouette",
  );
  pushFacetChips(state.fit, t("search.filters.fit"), "fits", "fit");
  pushFacetChips(
    state.closureType,
    t("search.filters.closureType"),
    "closureTypes",
    "closureType",
  );

  if (state.priceEnabled) {
    chips.push({
      key: `price:${state.priceMinDraft}:${state.priceMaxDraft}`,
      field: "price",
      value: `${state.priceMinDraft}:${state.priceMaxDraft}`,
      label: `${t("search.filters.price")}: ${formatSearchPrice(locale, Number(state.priceMinDraft))} - ${formatSearchPrice(locale, Number(state.priceMaxDraft))}`,
    });
  }

  return chips;
}

export {
  AUDIENCE_DISPLAY_ORDER,
  CORE_DISPLAY_ORDER,
  EMPTY_SEARCH_OPTIONS,
  INITIAL_SEARCH_STATE,
  SEASON_DISPLAY_ORDER,
};
export {
  buildSearchOptionsPayload,
  buildActiveFilterChips,
  clampPriceValue,
  createSearchState,
  getFacetLabel,
};
export {
  normalizeBrandOption,
  serializeDraftState,
  sortAudienceValues,
  sortCoreValues,
  sortItemsByLabel,
  sortSeasonValues,
  toggleSelection,
};

export type {
  ActiveFilterChip,
  SearchBrandOption,
  SearchDraftState,
  SearchFilterValue,
  SearchOptions,
  SearchPriceRange,
  SearchState,
  SerializedSearchState,
};
