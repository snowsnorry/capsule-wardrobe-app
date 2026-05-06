export type SearchPayload = {
  query: string;
  brand: string[];
  priceMin: number | null;
  priceMax: number | null;
  audience: string[];
  category: string[];
  season: string[];
  formalityLevel: string[];
  style: string[];
  occasions: string[];
  color: string[];
  pattern: string[];
  silhouette: string[];
  fit: string[];
  closureType: string[];
  page: number;
};

export type SearchOptions = {
  brands: Array<string | { value?: string | null }>;
  categories: string[];
  seasons: string[];
  formalityLevels: string[];
  styles: string[];
  occasions: string[];
  audience: string[];
  colors: string[];
  patterns: string[];
  silhouettes: string[];
  fits: string[];
  closureTypes: string[];
  priceRange: unknown;
};
