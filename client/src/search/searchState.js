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
});

const CORE_DISPLAY_ORDER = ["casual", "smart_casual", "formal"];
const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];
const AUDIENCE_DISPLAY_ORDER = ["man", "woman", "any"];

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
});

function createSearchState(savedSearch, priceRange) {
  const base = { ...INITIAL_SEARCH_STATE, ...(savedSearch || {}) };
  const hasPriceBounds = base.priceMin !== null || base.priceMax !== null;
  return {
    ...base,
    brand: Array.isArray(base.brand) ? base.brand : (base.brand ? [base.brand] : []),
    audience: Array.isArray(base.audience) ? base.audience : (base.audience ? [base.audience] : []),
    category: Array.isArray(base.category) ? base.category : (base.category ? [base.category] : []),
    formalityLevel: Array.isArray(base.formalityLevel) ? base.formalityLevel : (base.formalityLevel ? [base.formalityLevel] : []),
    style: Array.isArray(base.style) ? base.style : (base.style ? [base.style] : []),
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

function clampPriceValue(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(Math.max(parsed, min), max);
}

function serializeDraftState(state) {
  return {
    query: state.query,
    brand: state.brand,
    priceMin: state.priceEnabled ? state.priceMinDraft : null,
    priceMax: state.priceEnabled ? state.priceMaxDraft : null,
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

function toggleSelection(value, selected) {
  return selected.includes(value)
    ? selected.filter((item) => item !== value)
    : [...selected, value];
}

function normalizeBrandOption(item) {
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

function sortItemsByLabel(items, locale) {
  return [...items].sort((left, right) => left.label.localeCompare(right.label, locale));
}

function sortCoreValues(items) {
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

function sortSeasonValues(items) {
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

function sortAudienceValues(items) {
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

function buildSearchOptionsPayload(optionsResponse = {}) {
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
