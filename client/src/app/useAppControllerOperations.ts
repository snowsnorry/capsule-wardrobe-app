import { fetchAppBootstrap } from "../api/appBootstrap";
import { fetchCapsule } from "../api/capsules";
import { useRef } from "react";
import { buildDefaultActionContext } from "./buildDefaultActionContext";
import { buildDraftSnapshotFromState } from "./capsuleState";
import { applyCapsuleStateToApp } from "./capsuleStateActions";
import { refreshCapsuleList } from "./capsuleActions";
import { normalizeProfileSettings } from "./profileSettings";
import { applyWardrobeSnapshotToApp } from "./wardrobeSnapshotActions";
import {
  startCapsuleEventStream as startWardrobeEventStream,
  stopCapsuleEventStream as stopWardrobeEventStream,
} from "./wardrobeActions";
import type { AppControllerOperations } from "./appControllerOperations";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";
import type { useShareRoute } from "./useShareRoute";
import type {
  AppBootstrapResponse,
  CapsuleMeta,
  CapsulePagination,
} from "./appTypes";

const EMPTY_SIDEBAR_PAGINATION: CapsulePagination = {
  limit: 10,
  offset: 0,
  total: 0,
  hasMore: false,
};

export function useAppControllerOperations({
  appState,
  locale,
  notifications,
  profileOptions,
  resolveErrorMessage,
  setLocale,
  shareRoute,
  t,
}: {
  appState: ReturnType<typeof useAppState>;
  locale: string;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  profileOptions: ReturnType<typeof useProfileOptions>;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  setLocale: (locale: string) => void;
  shareRoute: ReturnType<typeof useShareRoute>;
  t: (key: string, params?: Record<string, unknown>) => string;
}): AppControllerOperations {
  const operationsRef = useRef<AppControllerOperations | null>(null);
  if (!operationsRef.current) {
    operationsRef.current = {} as AppControllerOperations;
  }
  const operations = operationsRef.current;
  assignAppControllerOperations({
    appState,
    notifications,
    operations,
    profileOptions,
    setLocale,
    t,
  });
  operations.getAppActionContext = () =>
    buildDefaultActionContext({
      appState,
      locale,
      notifications,
      operations,
      resolveErrorMessage,
      setLocale,
      shareRoute,
      t,
    });
  return operations;
}

function assignAppControllerOperations({
  appState,
  notifications,
  operations,
  profileOptions,
  setLocale,
  t,
}: {
  appState: ReturnType<typeof useAppState>;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  profileOptions: ReturnType<typeof useProfileOptions>;
  setLocale: (locale: string) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  operations.startPendingNotificationFlow = (
    kind: string,
    llm = appState.settingsProfile.llm,
  ) => {
    appState.pendingNotificationKindRef.current = kind;
    notifications.openPendingNotificationPrompt(llm);
  };
  operations.clearWardrobeProgressState = () => {
    clearWardrobeProgressState(appState, notifications, operations);
  };
  operations.clearActiveCapsuleState = (options = {}) => {
    applyCapsuleStateToApp(
      buildCapsuleStateSetters(appState, operations),
      null,
      options,
    );
  };
  operations.clearActiveOutfitState = (options = {}) => {
    clearActiveOutfitState(appState, options);
  };
  operations.applyCapsuleState = (
    capsule,
    { capsules = null, pagination = null } = {},
  ) => {
    applyCapsuleStateToApp(
      buildCapsuleStateSetters(appState, operations),
      capsule,
      { capsules, pagination },
    );
  };
  operations.buildCurrentDraftSnapshot = (options = {}) =>
    buildDraftSnapshotFromState(buildDraftSnapshotInput(appState, options));
  operations.applyWardrobeSnapshot = async (
    snapshot,
    capsuleId = appState.activeCapsuleId,
    options = {},
  ) => {
    await applyWardrobeSnapshotToApp(
      buildWardrobeSnapshotContext({ appState, notifications, operations, t }),
      snapshot,
      capsuleId,
      options,
    );
  };
  operations.startCapsuleEventStream = (capsuleId) =>
    startWardrobeEventStream(operations.getAppActionContext(), capsuleId);
  operations.bootstrapCapsules = buildBootstrapCapsulesOperation({
    appState,
    operations,
    profileOptions,
    setLocale,
  });
}

function buildBootstrapCapsulesOperation({
  appState,
  operations,
  profileOptions,
  setLocale,
}: {
  appState: ReturnType<typeof useAppState>;
  operations: AppControllerOperations;
  profileOptions: ReturnType<typeof useProfileOptions>;
  setLocale: (locale: string) => void;
}): AppControllerOperations["bootstrapCapsules"] {
  return async (email = appState.user?.email) => {
    const result = (await fetchAppBootstrap()) as AppBootstrapResponse;
    if (!result.hasProfile) {
      appState.setPersonalItemsCount(0);
      operations.applyCapsuleState(null, {
        capsules: [],
        pagination: EMPTY_SIDEBAR_PAGINATION,
      });
      appState.setOutfitList([]);
      appState.setOutfitPagination(EMPTY_SIDEBAR_PAGINATION);
      return {
        ...normalizeProfileSettings({}, email),
        hasProfile: false,
      };
    }
    const normalizedProfile = normalizeProfileSettings(result.profile, email);
    appState.setSettingsProfile(normalizedProfile);
    if (normalizedProfile.locale) setLocale(normalizedProfile.locale);
    const optionsLoaded = Boolean(result.wardrobeFilters);
    if (result.wardrobeFilters) {
      profileOptions.applyWardrobeFilters(result.wardrobeFilters);
    }
    operations.applyCapsuleState(result.activeCapsule, {
      capsules: result.capsules || [],
      pagination: result.capsulePagination || null,
    });
    appState.setOutfitList(result.outfits || []);
    if (result.outfitPagination) {
      appState.setOutfitPagination(result.outfitPagination);
    }
    appState.setPersonalItemsCount(
      typeof result.wardrobeCount === "number" ? result.wardrobeCount : null,
    );
    await restoreCapsuleSnapshot(operations, result);
    return { ...normalizedProfile, hasProfile: true, optionsLoaded };
  };
}

function clearActiveOutfitState(
  appState: ReturnType<typeof useAppState>,
  options: Parameters<AppControllerOperations["clearActiveOutfitState"]>[0],
) {
  appState.setActiveOutfitId("");
  appState.setActiveOutfitMeta(null);
  if (options?.outfits) {
    appState.setOutfitList(options.outfits);
  }
  if (options?.pagination) {
    appState.setOutfitPagination(options.pagination);
  }
}

function clearWardrobeProgressState(
  appState: ReturnType<typeof useAppState>,
  notifications: ReturnType<typeof useAppNotifications>,
  operations: AppControllerOperations,
) {
  if (operations.getAppActionContext) {
    stopWardrobeEventStream(operations.getAppActionContext());
  }
  appState.setSelectedRegenerationUrls([]);
  appState.pendingRegenerationUrlsRef.current = [];
  appState.regenerationBaseItemsRef.current = [];
  appState.manualWardrobeRegenerationCapsuleIdRef.current = "";
  appState.pendingNotificationKindRef.current = "";
  notifications.closeNotificationPrompt();
  appState.setPartialRegenerationPendingUrls([]);
  appState.setPendingImageSetIndexes([]);
  appState.setIsPartialRegenerationLoading(false);
  appState.setIsWardrobePending(false);
  appState.setHasPendingAdditionalItems(false);
  appState.setIsLoadingItems(false);
}

function buildCapsuleStateSetters(
  state: ReturnType<typeof useAppState>,
  operations: AppControllerOperations,
) {
  return {
    clearWardrobeProgressState: operations.clearWardrobeProgressState,
    setActiveCapsuleId: state.setActiveCapsuleId,
    setActiveCapsuleMeta: state.setActiveCapsuleMeta,
    setCapsuleList: state.setCapsuleList,
    setCapsulePagination: state.setCapsulePagination,
    setPendingImageSetIndexes: state.setPendingImageSetIndexes,
    setProfileItems: state.setProfileItems,
    setProfileOutfitSets: state.setProfileOutfitSets,
    setSelectedAudience: state.setSelectedAudience,
    setSelectedColor: state.setSelectedColor,
    setSelectedFormalityLevel: state.setSelectedFormalityLevel,
    setSelectedOccasions: state.setSelectedOccasions,
    setSelectedPattern: state.setSelectedPattern,
    setSelectedSeason: state.setSelectedSeason,
    setSelectedSourceMode: state.setSelectedSourceMode,
    setSelectedStyle: state.setSelectedStyle,
    setSelectedText: state.setSelectedText,
    setSelectedAnchorItemRefs: state.setSelectedAnchorItemRefs,
  };
}

function buildDraftSnapshotInput(
  state: ReturnType<typeof useAppState>,
  {
    wardrobe,
    rejectedUrls = null,
  }: Parameters<AppControllerOperations["buildCurrentDraftSnapshot"]>[0] = {},
) {
  return {
    activeCapsuleMeta: state.activeCapsuleMeta,
    profileItems: state.profileItems,
    profileOutfitSets: state.profileOutfitSets,
    rejectedUrls,
    selectedAudience: state.selectedAudience,
    selectedColor: state.selectedColor,
    selectedFormalityLevel: state.selectedFormalityLevel,
    selectedOccasions: state.selectedOccasions,
    selectedPattern: state.selectedPattern,
    selectedSeason: state.selectedSeason,
    selectedSourceMode: state.selectedSourceMode,
    selectedStyle: state.selectedStyle,
    selectedText: state.selectedText,
    selectedAnchorItemRefs: state.selectedAnchorItemRefs,
    wardrobe,
  };
}

function buildWardrobeSnapshotContext({
  appState,
  notifications,
  operations,
  t,
}: {
  appState: ReturnType<typeof useAppState>;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return {
    activeCapsuleId: appState.activeCapsuleId,
    closeNotificationPrompt: notifications.closeNotificationPrompt,
    fetchCapsule: async (capsuleId: string) =>
      fetchCapsule(capsuleId) as Promise<{ capsule?: CapsuleMeta | null }>,
    manualWardrobeRegenerationCapsuleIdRef:
      appState.manualWardrobeRegenerationCapsuleIdRef,
    pendingNotificationKindRef: appState.pendingNotificationKindRef,
    pendingRegenerationUrlsRef: appState.pendingRegenerationUrlsRef,
    refreshCapsuleList: async () => {
      await refreshCapsuleList(operations.getAppActionContext());
    },
    regenerationBaseItemsRef: appState.regenerationBaseItemsRef,
    sendReadyNotification: notifications.sendReadyNotification,
    setActiveCapsuleMeta: appState.setActiveCapsuleMeta,
    setHasPendingAdditionalItems: appState.setHasPendingAdditionalItems,
    setIsLoadingItems: appState.setIsLoadingItems,
    setIsPartialRegenerationLoading: appState.setIsPartialRegenerationLoading,
    setIsWardrobePending: appState.setIsWardrobePending,
    setPartialRegenerationPendingUrls:
      appState.setPartialRegenerationPendingUrls,
    setPendingImageSetIndexes: appState.setPendingImageSetIndexes,
    setProfileItems: appState.setProfileItems,
    setProfileOutfitSets: appState.setProfileOutfitSets,
    setSelectedRegenerationUrls: appState.setSelectedRegenerationUrls,
    setStatus: appState.setStatus,
    stopCapsuleEventStream: () =>
      stopWardrobeEventStream(operations.getAppActionContext()),
    t,
  };
}

async function restoreCapsuleSnapshot(
  operations: AppControllerOperations,
  result: AppBootstrapResponse,
) {
  if (!result.activeSnapshot) return;
  await operations.applyWardrobeSnapshot(
    result.activeSnapshot,
    result.activeCapsule?.id,
    { refreshReadyCapsule: false },
  );
  if (result.activeSnapshot.status === "pending") {
    operations.startCapsuleEventStream(result.activeCapsule?.id);
  }
}
