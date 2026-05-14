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
  image_llm?: string;
};

export type CapsuleFilters = {
  formalityLevel: string;
  style: string | null;
  occasions: string[];
  season: string[];
  audience: string;
  color: string | null;
  pattern: string;
  text: string;
};

export type OutfitSetSnapshot = {
  itemIds: string[];
  image: string | null;
  imageObsolete: boolean;
};

export type WardrobeItem = {
  id?: string | number;
  url?: string;
  [key: string]: unknown;
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

export type CapsuleSidebarActions = {
  openSearchDialog: () => void;
  openCapsuleActions: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleMeta,
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
  activeSnapshot?: WardrobeSnapshot;
  wardrobeFilters?: WardrobeFiltersResponse | null;
};

export type CapsuleBootstrapResult = ProfileSettings & {
  hasProfile: boolean;
  optionsLoaded?: boolean;
};

export type CapsuleListResponse = {
  capsules?: CapsuleMeta[];
};

export type CapsuleMutationResponse = {
  capsule?: CapsuleMeta | null;
  activeCapsule?: CapsuleMeta | null;
  status?: string;
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
  | "explore"
  | "myWardrobe"
  | "statistics"
  | "share";

export type AppNavigationOptions = {
  query?: string;
  openProductDetail?: boolean;
};
