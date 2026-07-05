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
  "catalog_only" | "wardrobe_preferred" | "wardrobe_only";

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

type OutfitReportVerdictStatus =
  "valid" | "acceptable_with_notes" | "incomplete" | "incoherent";

type OutfitReportVerdict = {
  llmScore?: number;
  llmStatus?: OutfitReportVerdictStatus | string;
  status?: OutfitReportVerdictStatus | string;
  score?: number;
  summary?: string;
};

type OutfitReportComposition = {
  itemCount?: number;
  categoryCounts?: Record<string, number>;
  completeness?: string;
  detectedRoles?: string[];
  missingCoreRoles?: string[];
  extraRoles?: string[];
};

type OutfitReportTemperatureBandC = {
  min?: number | null;
  max?: number | null;
};

type OutfitReportSeasonality = {
  primarySeasons?: string[];
  secondarySeasons?: string[];
  temperatureBandC?: OutfitReportTemperatureBandC;
  weatherSuitability?: string[];
  weatherLimitations?: string[];
  seasonScore?: number;
};

type OutfitReportStyleProfile = {
  primaryStyle?: string;
  secondaryStyles?: string[];
  formalityLevel?: string;
  occasions?: string[];
  styleKeywords?: string[];
  styleScore?: number;
};

type OutfitReportCompatibility = {
  overallScore?: number;
  styleCoherence?: number;
  formalityCoherence?: number;
  seasonalCoherence?: number;
  colorCoherence?: number;
  mainStrengths?: string[];
  mainRisks?: string[];
};

type OutfitReportColorAnalysis = {
  paletteType?: string;
  dominantColors?: string[];
  accentColors?: string[];
  contrastLevel?: string;
  harmony?: string;
  colorScore?: number;
  notes?: string;
};

export type OutfitReportIssue = {
  code?: string;
  severity?: "info" | "warning" | "critical" | string;
  dimension?: string;
  message?: string;
  affectedItemIds?: string[];
  suggestion?: string;
};

export type OutfitReportSuggestion = {
  type?: "add" | "remove" | "replace" | "keep" | "adjust" | string;
  priority?: "low" | "medium" | "high" | string;
  targetItemIds?: string[];
  replacementCategory?: string | null;
  replacementDescription?: string | null;
  message?: string;
};

type OutfitReportConfidence = {
  overall?: number;
  lowConfidenceAspects?: string[];
  assumptions?: string[];
};

export type OutfitReport = {
  schemaVersion?: number;
  itemsHash?: string;
  verdict?: OutfitReportVerdict;
  composition?: OutfitReportComposition;
  seasonality?: OutfitReportSeasonality;
  styleProfile?: OutfitReportStyleProfile;
  compatibility?: OutfitReportCompatibility;
  colorAnalysis?: OutfitReportColorAnalysis;
  issues?: OutfitReportIssue[];
  suggestions?: OutfitReportSuggestion[];
  confidence?: OutfitReportConfidence;
};

type OutfitReportMeta = {
  stale?: boolean;
};

type CapsuleReportVerdictStatus =
  | "excellent"
  | "good"
  | "usable_with_gaps"
  | "off_target"
  | "incomplete"
  | "incoherent";

type CapsuleReportVerdict = {
  llmScore?: number;
  llmStatus?: CapsuleReportVerdictStatus | string;
  status?: CapsuleReportVerdictStatus | string;
  score?: number;
  summary?: string;
};

type CapsuleReportTemperatureBandC = {
  min?: number | null;
  max?: number | null;
};

type CapsuleReportCapsuleSummary = {
  itemCount?: number;
  categoryCounts?: Record<string, number>;
  detectedCategoryBalance?: string;
  capsuleType?: string;
  summaryTags?: string[];
};

type CapsuleReportTargetAlignment = {
  overallScore?: number;
  formalityFit?: {
    detectedRange?: string[];
  };
  styleFit?: {
    primaryDetectedStyle?: string;
  };
};

type CapsuleReportCoverage = {
  overallScore?: number;
  coreRoleCoverage?: Record<string, string>;
  missingCategories?: string[];
  weakCategories?: string[];
  overrepresentedCategories?: string[];
  notes?: string;
};

type CapsuleReportVersatility = {
  overallScore?: number;
  notes?: string;
};

type CapsuleReportCohesion = {
  overallScore?: number;
  mainStrengths?: string[];
  mainRisks?: string[];
  notes?: string;
};

type CapsuleReportSeasonality = {
  overallScore?: number;
  primarySeasons?: string[];
  secondarySeasons?: string[];
  temperatureBandC?: CapsuleReportTemperatureBandC;
  notes?: string;
};

type CapsuleReportStyleProfile = {
  formalityLevel?: string;
  primaryStyle?: string;
};

type CapsuleReportColorAnalysis = {
  paletteType?: string;
  colorScore?: number;
  notes?: string;
};

type CapsuleReportGeneratedOutfitAssessment = {
  providedOutfitCount?: number;
  completeOutfitCount?: number;
  weakOutfitCount?: number;
  weakOutfits?: Array<{
    outfitId?: string;
    severity?: "info" | "warning" | "critical" | string;
    issue?: string;
    affectedItemIds?: string[];
    suggestion?: string;
  }>;
  notes?: string;
};

export type CapsuleReportIssue = OutfitReportIssue;

export type CapsuleReportSuggestion = OutfitReportSuggestion & {
  targetCategory?: string | null;
  replacementCategory?: string | null;
};

type CapsuleReportConfidence = OutfitReportConfidence;

export type CapsuleReport = {
  schemaVersion?: number;
  itemsHash?: string;
  verdict?: CapsuleReportVerdict;
  capsuleSummary?: CapsuleReportCapsuleSummary;
  targetAlignment?: CapsuleReportTargetAlignment;
  coverage?: CapsuleReportCoverage;
  versatility?: CapsuleReportVersatility;
  cohesion?: CapsuleReportCohesion;
  seasonality?: CapsuleReportSeasonality;
  styleProfile?: CapsuleReportStyleProfile;
  colorAnalysis?: CapsuleReportColorAnalysis;
  generatedOutfitAssessment?: CapsuleReportGeneratedOutfitAssessment;
  issues?: CapsuleReportIssue[];
  suggestions?: CapsuleReportSuggestion[];
  confidence?: CapsuleReportConfidence;
};

export type { PersonalItemsReport } from "./personalItemsReportTypes";

type CapsuleReportMeta = {
  stale?: boolean;
};

type OutfitSnapshot = {
  items: OutfitItemSnapshot[];
  image?: string | null;
  imageObsolete?: boolean;
  report?: OutfitReport | null;
  reportMeta?: OutfitReportMeta | null;
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
  report?: CapsuleReport | null;
  reportMeta?: CapsuleReportMeta | null;
};

export type CapsuleMeta = {
  id?: string;
  name?: string;
  pin?: boolean;
  draft?: CapsuleDraft | null;
  saved?: CapsuleDraft | null;
  effective?: CapsuleDraft | null;
  status?: string;
  updatedAt?: string;
};

export type OutfitMeta = {
  id?: string;
  name?: string;
  pin?: boolean;
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

export type AppBootstrapResponse = {
  hasProfile?: boolean;
  profile?: Partial<ProfileSettings> | null;
  activeCapsule?: CapsuleMeta | null;
  activeSnapshot?: WardrobeSnapshot | null;
  capsules?: CapsuleMeta[];
  capsulePagination?: CapsulePagination | null;
  outfits?: OutfitMeta[];
  outfitPagination?: CapsulePagination | null;
  wardrobeFilters?: WardrobeFiltersResponse | null;
  wardrobeCount?: number | null;
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
  job?: { id?: string; status?: string } | null;
  outfit?: OutfitMeta | null;
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
  job?: { id?: string; status?: string } | null;
  outfitSets?: OutfitSetSnapshot[];
  status?: string;
};

export type AppRoute =
  "capsule" | "outfit" | "explore" | "wardrobe" | "statistics" | "share";

export type AppNavigationOptions = {
  query?: string;
  openProductDetail?: boolean;
};

export type CapsuleRouteMode = "empty" | "create" | "open";

export type OutfitRouteMode = "empty" | "create" | "open";

export type CapsuleNavigationOptions = {
  replace?: boolean;
};
