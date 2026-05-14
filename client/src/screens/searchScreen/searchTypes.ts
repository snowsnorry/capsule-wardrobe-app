export type SearchResultItem = {
  id: string | number;
  name?: string;
  brand?: string;
  category?: string;
  url?: string;
  imageUrl?: string;
  description?: string;
  audience?: string;
  isSavedToWardrobe?: boolean;
  is_saved_to_wardrobe?: boolean;
  savedToMyWardrobe?: boolean;
  [key: string]: unknown;
};

export type SearchStatus = {
  loading: boolean;
  error: string;
};
