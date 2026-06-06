export type SearchFilterValue = string;
export type SearchBrandOption = string | { value: string; label?: string };

export type SearchPriceRange = {
  min: number | null;
  max: number | null;
};

export type SearchOptions = {
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

export type SearchState = {
  query: string;
  likedOnly: boolean;
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

export type SearchStateSource = Omit<
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

export type SearchArrayField = keyof Pick<
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

export type SearchDraftState = SearchState & {
  priceEnabled: boolean;
  priceMinDraft: number | string;
  priceMaxDraft: number | string;
};

export type SerializedSearchState = SearchState;

export type SearchTranslator = (
  key: string,
  params?: Record<string, unknown>,
) => string;

export type ActiveFilterChip = {
  key: string;
  field: keyof SearchDraftState | "price";
  values?: string[];
  value?: string;
  label: string;
};
