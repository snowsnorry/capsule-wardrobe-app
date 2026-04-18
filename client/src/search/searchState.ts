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

type SearchStateSource = Omit<SearchState, "brand" | "audience" | "category" | "season" | "formalityLevel" | "style" | "occasions" | "color" | "pattern" | "silhouette" | "fit" | "closureType"> & {
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

type SearchDraftState = SearchState & {
  priceEnabled: boolean;
  priceMinDraft: number | string;
  priceMaxDraft: number | string;
};

type SerializedSearchState = SearchState;

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
  page: 1
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
  priceRange: { min: null, max: null }
}) satisfies SearchOptions;

function createSearchState(savedSearch: Partial<SearchStateSource> | null | undefined, priceRange: SearchPriceRange): SearchDraftState {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  return {
    ...base,
    brand: Array.isArray(base.brand) ? base.brand : (base.brand ? [base.brand] : []),
    audience: Array.isArray(base.audience) ? base.audience : (base.audience ? [base.audience] : []),
    category: Array.isArray(base.category) ? base.category : (base.category ? [base.category] : []),
    season: Array.isArray(base.season) ? base.season : (base.season ? [base.season] : []),
    formalityLevel: Array.isArray(base.formalityLevel) ? base.formalityLevel : (base.formalityLevel ? [base.formalityLevel] : []),
    style: Array.isArray(base.style) ? base.style : (base.style ? [base.style] : []),
    occasions: Array.isArray(base.occasions) ? base.occasions : (base.occasions ? [base.occasions] : []),
    color: Array.isArray(base.color) ? base.color : (base.color ? [base.color] : []),
    pattern: Array.isArray(base.pattern) ? base.pattern : (base.pattern ? [base.pattern] : []),
    silhouette: Array.isArray(base.silhouette) ? base.silhouette : (base.silhouette ? [base.silhouette] : []),
    fit: Array.isArray(base.fit) ? base.fit : (base.fit ? [base.fit] : []),
    closureType: Array.isArray(base.closureType) ? base.closureType : (base.closureType ? [base.closureType] : []),
    priceEnabled: hasPriceBounds,
    priceMinDraft: hasPriceBounds
      ? base.priceMin ?? priceRange.min ?? 0
      : priceRange.min ?? 0,
    priceMaxDraft: hasPriceBounds
      ? base.priceMax ?? priceRange.max ?? 0
      : priceRange.max ?? 0
  };
}

function clampPriceValue(value: number | string | null | undefined, min: number, max: number): number {
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
    page: state.page
  };
}

function toggleSelection(value: SearchFilterValue, selected: SearchFilterValue[]): SearchFilterValue[] {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function normalizeBrandOption(item: SearchBrandOption | null | undefined): { value: string; label: string } | null {
  if (typeof item === "string") {
    return { value: item, label: item };
  }

  if (item && typeof item.value === "string") {
    return {
      value: item.value,
      label: typeof item.label === "string" && item.label.trim() ? item.label : item.value
    };
  }

  return null;
}

function sortItemsByLabel(items: Array<{ value: string; label: string }>, locale: string): Array<{ value: string; label: string }> {
  return [...items].sort((left, right) => left.label.localeCompare(right.label, locale));
}

function sortCoreValues(items: SearchFilterValue[]): SearchFilterValue[] {
  return [...items].sort((left, right) => {
    const leftIndex = CORE_DISPLAY_ORDER.indexOf(left);
    const rightIndex = CORE_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? CORE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? CORE_DISPLAY_ORDER.length : rightIndex;

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
    const normalizedLeft = leftIndex === -1 ? SEASON_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? SEASON_DISPLAY_ORDER.length : rightIndex;

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
    const normalizedLeft = leftIndex === -1 ? AUDIENCE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? AUDIENCE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function buildSearchOptionsPayload(optionsResponse: Partial<SearchOptions> = {}): SearchOptions {
  return {
    brands: optionsResponse.brands || [],
    categories: optionsResponse.categories || [],
    seasons: optionsResponse.seasons || [],
    formalityLevels: optionsResponse.formalityLevels || [],
    styles: optionsResponse.styles || [],
    occasions: optionsResponse.occasions || [],
    audience: optionsResponse.audience || [],
    colors: optionsResponse.colors || [],
    patterns: optionsResponse.patterns || [],
    silhouettes: optionsResponse.silhouettes || [],
    fits: optionsResponse.fits || [],
    closureTypes: optionsResponse.closureTypes || [],
    priceRange: optionsResponse.priceRange || { min: null, max: null }
  };
}

export {
  AUDIENCE_DISPLAY_ORDER,
  CORE_DISPLAY_ORDER,
  EMPTY_SEARCH_OPTIONS,
  INITIAL_SEARCH_STATE,
  SEASON_DISPLAY_ORDER,
  buildSearchOptionsPayload,
  clampPriceValue,
  createSearchState,
  normalizeBrandOption,
  serializeDraftState,
  sortAudienceValues,
  sortCoreValues,
  sortItemsByLabel,
  sortSeasonValues,
  toggleSelection
};

export type {
  SearchBrandOption,
  SearchDraftState,
  SearchFilterValue,
  SearchOptions,
  SearchPriceRange,
  SearchState,
  SerializedSearchState
};
