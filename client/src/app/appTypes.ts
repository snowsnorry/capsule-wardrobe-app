import type { MouseEvent } from "react";

export type StatusState = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

export type NotificationPromptState = {
  open: boolean;
};

export type PasskeyPromptState = {
  open: boolean;
  loading: boolean;
};

export type UserLike = {
  email?: string;
};

export type SessionStep = "email" | "code";

export type ProfileSettings = {
  email: string;
  locale: string;
  fullname: string;
  theme: string;
  llm: string;
  imageLlm: string;
};

export type CapsuleSourceMode =
  | "catalog_only"
  | "wardrobe_preferred"
  | "wardrobe_only";

export type AnchorItemRef = {
  source: "uploaded" | "from_catalog";
  url: string;
};

export type CapsuleFilters = {
  sourceMode: CapsuleSourceMode;
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
  anchorWardrobeItemIds: string[];
  anchorItemRefs: AnchorItemRef[];
};

export type OutfitSetSnapshot = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

export type WardrobeItem = {
  id?: string | number;
  url?: string;
  isLiked?: boolean | null;
  [key: string]: unknown;
};

export type OutfitItemSource = "uploaded" | "from_catalog";

export type OutfitItemSnapshot = {
  source: OutfitItemSource;
  url: string;
  item?: WardrobeItem | null;
};

type OutfitSnapshot = {
  items: OutfitItemSnapshot[];
};

export type CapsuleWardrobeData = {
  items: WardrobeItem[];
  outfitSets?: OutfitSetSnapshot[];
  rawSelectionText?: string | null;
  swimwearReasoning?: string | null;
  swimwearRawSelectionText?: string | null;
};

export type CapsuleDraft = {
  filters: CapsuleFilters;
  data: {
    wardrobe: CapsuleWardrobeData | null;
    rejectedUrls: string[];
  };
};

export type CapsuleMeta = {
  id?: string;
  name?: string;
  draft?: CapsuleDraft | null;
  saved?: CapsuleDraft | null;
  effective?: CapsuleDraft | null;
  status?: string;
  updatedAt?: string;
};

export type OutfitMeta = {
  id?: string;
  name?: string;
  draft?: OutfitSnapshot | null;
  saved?: OutfitSnapshot | null;
  effective?: OutfitSnapshot | null;
  status?: string;
  updatedAt?: string;
  itemCount?: number;
};

export type CapsulePagination = {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
};

export type CapsuleSidebarActions = {
  openSearchDialog: () => void;
  openCapsuleActions: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleMeta,
  ) => void;
};

export type OutfitSidebarActions = {
  openSearchDialog: () => void;
  openOutfitActions: (
    event: MouseEvent<HTMLElement>,
    outfit: OutfitMeta,
  ) => void;
};

export type WardrobeSnapshot = {
  status?: string;
  items?: WardrobeItem[];
  outfitSets?: OutfitSetSnapshot[];
  pendingRegenerationUrls?: string[];
  pendingImageSetIndexes?: number[];
  hasPendingAdditionalItems?: boolean;
  rawSelectionText?: string | null;
  error?: string | null;
};

export type ProfileOptionsResult = {
  styles: {
    core: string[];
    aesthetics: string[];
  };
  occasions: string[];
  seasons: string[];
  audience: string[];
  patterns: string[];
};

export type WardrobeFiltersResponse = {
  formalityLevels?: string[] | null;
  styles?: string[] | null;
  occasions?: string[] | null;
  seasons?: string[] | null;
  audience?: string[] | null;
  patterns?: string[] | null;
};

export type CurrentUserResponse = {
  user?: UserLike | null;
};

export type AuthResultResponse = {
  user?: UserLike | null;
  expiresInMs?: number;
};

export type CapsuleBootstrapResponse = {
  hasProfile?: boolean;
  profile?: Partial<ProfileSettings>;
  activeCapsule?: CapsuleMeta | null;
  capsules?: CapsuleMeta[];
  pagination?: CapsulePagination;
  activeSnapshot?: WardrobeSnapshot;
  wardrobeFilters?: WardrobeFiltersResponse | null;
};

export type OutfitBootstrapResponse = {
  outfits?: OutfitMeta[];
  pagination?: CapsulePagination;
};

export type CapsuleBootstrapResult = ProfileSettings & {
  hasProfile: boolean;
  optionsLoaded?: boolean;
};

export type CapsuleListResponse = {
  capsules?: CapsuleMeta[];
  pagination?: CapsulePagination;
};

export type OutfitListResponse = {
  outfits?: OutfitMeta[];
  pagination?: CapsulePagination;
};

export type CapsuleMutationResponse = {
  capsule?: CapsuleMeta | null;
  activeCapsule?: CapsuleMeta | null;
  status?: string;
};

export type OutfitMutationResponse = {
  outfit?: OutfitMeta | null;
};

export type ShareMetadata = {
  id?: string;
  name?: string;
  expiresAt?: string | Date;
};

export type WardrobeMutationResponse = {
  image?: string | null;
  items?: WardrobeItem[];
  outfitSets?: OutfitSetSnapshot[];
  status?: string;
};

export type AppRoute =
  | "capsule"
  | "outfit"
  | "explore"
  | "wardrobe"
  | "statistics"
  | "share";

export type AppNavigationOptions = {
  query?: string;
  openProductDetail?: boolean;
};

export type CapsuleRouteMode = "empty" | "create" | "open";

export type OutfitRouteMode = "empty" | "create" | "open";

export type CapsuleNavigationOptions = {
  replace?: boolean;
};
