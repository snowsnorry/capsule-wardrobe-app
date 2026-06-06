export type SearchResultItem = {
  id: string | number;
  name?: string;
  brand?: string;
  category?: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  audience?: string;
  isLiked?: boolean | null;
  isSavedToWardrobe?: boolean;
  savedToMyWardrobe?: boolean;
  [key: string]: unknown;
};

export type SearchResponse = {
  items?: SearchResultItem[];
  total?: number;
};

export type SearchStatus = {
  loading: boolean;
  error: string;
};
