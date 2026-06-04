import {
  areFiltersEqual,
  buildEmptyCapsuleDraft,
  getEffectiveCapsule,
} from "./capsuleState";
import type { AppRoute, CapsuleDraft, CapsuleMeta, UserLike } from "./appTypes";

type ViewStateOptions = {
  activeCapsuleMeta: CapsuleMeta | null;
  appRoute: AppRoute;
  buildCurrentDraftSnapshot: (options?: { wardrobe?: null }) => CapsuleDraft;
  currentView: string;
  hasProfile: boolean;
  isContentOperationLoading: boolean;
  isDownloadingWardrobePdf: boolean;
  isLoadingItems: boolean;
  isPartialRegenerationLoading: boolean;
  isWardrobePending: boolean;
  pendingImageSetIndexes: number[];
  profileCreated: boolean;
  user: UserLike | null;
};

export function resolveThemeMode(
  theme: string | undefined,
  prefersDarkMode: boolean,
) {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return prefersDarkMode ? "dark" : "light";
}

export function buildAppViewState(options: ViewStateOptions) {
  const hasUsableProfile = options.hasProfile || options.profileCreated;
  const views = buildRouteViewState(options, hasUsableProfile);
  return {
    ...views,
    hasBrandedPanelHeader: Object.values(views).some(Boolean),
    hasFilterChanges: hasFilterChanges(options),
    isContentBusy: isContentBusy(options),
  };
}

function buildRouteViewState(
  options: ViewStateOptions,
  hasUsableProfile: boolean,
) {
  const isProfileUser = Boolean(options.user && hasUsableProfile);
  return {
    isMainScreenView: Boolean(
      isProfileUser &&
      options.currentView === "main" &&
      ["capsule", "share"].includes(options.appRoute),
    ),
    isSearchView: Boolean(isProfileUser && options.appRoute === "explore"),
    isWardrobeView: Boolean(isProfileUser && options.appRoute === "wardrobe"),
    isSignInView: !options.user,
    isStatisticsView: Boolean(
      isProfileUser && options.appRoute === "statistics",
    ),
  };
}

function hasFilterChanges(options: ViewStateOptions) {
  return !areFiltersEqual(
    options.buildCurrentDraftSnapshot({ wardrobe: null }).filters,
    getEffectiveCapsule(options.activeCapsuleMeta)?.filters ||
      buildEmptyCapsuleDraft().filters,
  );
}

function isContentBusy(options: ViewStateOptions) {
  return Boolean(
    options.isLoadingItems ||
    options.isWardrobePending ||
    options.isPartialRegenerationLoading ||
    options.isContentOperationLoading ||
    options.isDownloadingWardrobePdf ||
    options.pendingImageSetIndexes.length > 0,
  );
}

export function toggleStringSelection(
  value: string,
  selected: string[],
  setter: (value: string[]) => void,
) {
  setter(
    selected.includes(value)
      ? selected.filter((item) => item !== value)
      : [...selected, value],
  );
}
