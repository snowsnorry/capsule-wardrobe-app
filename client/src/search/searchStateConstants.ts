import type {
  SearchArrayField,
  SearchOptions,
  SearchState,
} from "./searchStateTypes";

export const INITIAL_SEARCH_STATE = Object.freeze({
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

export const CORE_DISPLAY_ORDER = ["casual", "smart_casual", "formal"];
export const SEASON_DISPLAY_ORDER = ["spring", "summer", "autumn", "winter"];
export const AUDIENCE_DISPLAY_ORDER = ["woman", "man", "all"];

export const EMPTY_SEARCH_OPTIONS = Object.freeze({
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

export const SEARCH_ARRAY_FIELDS: readonly SearchArrayField[] = [
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

export const SEARCH_OPTION_ARRAY_FIELDS = [
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
