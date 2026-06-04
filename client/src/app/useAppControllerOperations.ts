import { fetchCapsule, fetchCapsuleBootstrap } from "../api/capsules";
import { buildAppActionContext } from "./buildAppActionContext";
import { buildDraftSnapshotFromState } from "./capsuleState";
import { applyCapsuleStateToApp } from "./capsuleStateActions";
import { refreshCapsuleList } from "./capsuleActions";
import { normalizeProfileSettings } from "./profileSettings";
import { applyWardrobeSnapshotToApp } from "./wardrobeSnapshotActions";
import {
  startCapsuleEventStream as startWardrobeEventStream,
  stopCapsuleEventStream as stopWardrobeEventStream,
} from "./wardrobeActions";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useProfileOptions } from "./useProfileOptions";
import type { useShareRoute } from "./useShareRoute";
import type {
  CapsuleBootstrapResponse,
  CapsuleBootstrapResult,
  CapsuleDraft,
  CapsuleMeta,
  CapsuleWardrobeData,
  OutfitSetSnapshot,
  WardrobeItem,
  WardrobeSnapshot,
} from "./appTypes";

export type AppControllerOperations = {
  applyCapsuleState: (
    capsule: CapsuleMeta | null | undefined,
    options?: { capsules?: CapsuleMeta[] | null },
  ) => void;
  applyWardrobeSnapshot: (
    snapshot: WardrobeSnapshot | undefined,
    capsuleId?: string,
    options?: { refreshReadyCapsule?: boolean },
  ) => Promise<void>;
  bootstrapCapsules: (email?: string) => Promise<CapsuleBootstrapResult>;
  buildCurrentDraftSnapshot: (options?: {
    wardrobe?:
      | CapsuleWardrobeData
      | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] }
      | null;
    rejectedUrls?: string[] | null;
  }) => CapsuleDraft;
  clearWardrobeProgressState: () => void;
  clearActiveCapsuleState: (options?: {
    capsules?: CapsuleMeta[] | null;
  }) => void;
  getAppActionContext: () => ReturnType<typeof buildAppActionContext>;
  startCapsuleEventStream: (capsuleId: string | undefined) => unknown;
  startPendingNotificationFlow: (kind: string, llm?: string) => void;
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
  const operations = {} as AppControllerOperations;
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
  operations.applyCapsuleState = (capsule, { capsules = null } = {}) => {
    applyCapsuleStateToApp(
      buildCapsuleStateSetters(appState, operations),
      capsule,
      { capsules },
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
  operations.bootstrapCapsules = async (email = appState.user?.email) => {
    const result = (await fetchCapsuleBootstrap()) as CapsuleBootstrapResponse;
    if (!result.hasProfile) {
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
    });
    await restoreCapsuleSnapshot(operations, result);
    return { ...normalizedProfile, hasProfile: true, optionsLoaded };
  };
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
    setSelectedAnchorWardrobeItemIds: state.setSelectedAnchorWardrobeItemIds,
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
    selectedAnchorWardrobeItemIds: state.selectedAnchorWardrobeItemIds,
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
  result: CapsuleBootstrapResponse,
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

function buildDefaultActionContext({
  appState,
  locale,
  notifications,
  operations,
  resolveErrorMessage,
  setLocale,
  shareRoute,
  t,
}: {
  appState: ReturnType<typeof useAppState>;
  locale: string;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  setLocale: (locale: string) => void;
  shareRoute: ReturnType<typeof useShareRoute>;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return buildAppActionContext({
    appState,
    applyCapsuleState: operations.applyCapsuleState,
    applyWardrobeSnapshot: operations.applyWardrobeSnapshot,
    bootstrapCapsules: operations.bootstrapCapsules,
    buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
    clearShareRoute: shareRoute.clearShareRoute,
    closeNotificationPrompt: notifications.closeNotificationPrompt,
    handlers: {} as ReturnType<typeof useAppHandlers>,
    locale,
    pendingShareId: "",
    resolveErrorMessage,
    setIsShareLoading: shareRoute.setIsShareLoading,
    setLocale,
    shareMetadata: shareRoute.shareMetadata,
    startCapsuleEventStream: operations.startCapsuleEventStream,
    startPendingNotificationFlow: operations.startPendingNotificationFlow,
    t,
  });
}
