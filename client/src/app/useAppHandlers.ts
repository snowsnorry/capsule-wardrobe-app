import {
  applyCapsuleFilters,
  deleteCurrentCapsule,
  deleteCurrentCapsuleReport,
  duplicateCurrentCapsule,
  generateCurrentCapsuleReport,
  importSharedCapsuleToApp,
  renameCurrentCapsule,
  revertCurrentCapsule,
  saveCurrentCapsule,
  setCurrentCapsulePin,
} from "./capsuleActions";
import { useCallback, useMemo } from "react";
import {
  deleteCurrentOutfitReport,
  deleteCurrentOutfit,
  duplicateCurrentOutfit,
  generateCurrentOutfitReport,
  renameCurrentOutfit,
  revertCurrentOutfit,
  saveCurrentOutfit,
  setCurrentOutfitPin,
  selectUserOutfit,
} from "./outfitActions";
import { selectCapsule } from "../api/capsules";
import { type SessionActionContext } from "./sessionActions";
import type { AppActionContext } from "./actionContext";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleSidebarActions,
  OutfitSidebarActions,
} from "./appTypes";
import { buildAppHandlers } from "./appHandlerBuilder";

type UseAppHandlersOptions = {
  activeCapsuleId: string;
  activeOutfitId?: string;
  capsuleSidebarActionsRef: { current: CapsuleSidebarActions | null };
  outfitSidebarActionsRef?: { current: OutfitSidebarActions | null };
  getAppActionContext: () => AppActionContext;
  navigateCapsule: (capsuleId: string, options?: { replace?: boolean }) => void;
  navigateOutfit?: (outfitId: string, options?: { replace?: boolean }) => void;
  navigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  navigateNewCapsule: (options?: { replace?: boolean }) => void;
  navigateNewOutfit?: (options?: { replace?: boolean }) => void;
  pendingShareId: string;
  setCurrentView: (view: string) => void;
  setIsSignOutConfirmOpen: (open: boolean) => void;
  setSelectedRegenerationUrls: (urls: string[]) => void;
  shareMetadata: { id?: string } | null;
  sessionActionContext: SessionActionContext;
};

type MemoizedHandlerInputOptions = Pick<
  UseAppHandlersOptions,
  | "activeCapsuleId"
  | "getAppActionContext"
  | "navigateApp"
  | "navigateCapsule"
  | "navigateNewCapsule"
  | "pendingShareId"
  | "shareMetadata"
> & {
  activeOutfitId: string;
  navigateOutfit: NonNullable<UseAppHandlersOptions["navigateOutfit"]>;
  navigateNewOutfit: NonNullable<UseAppHandlersOptions["navigateNewOutfit"]>;
};

const EMPTY_OUTFIT_SIDEBAR_ACTIONS_REF = { current: null };
const noopNavigateEntity = () => {};
const noopNavigateNew = () => {};

export function useAppHandlers({
  activeCapsuleId,
  activeOutfitId = "",
  capsuleSidebarActionsRef,
  outfitSidebarActionsRef = EMPTY_OUTFIT_SIDEBAR_ACTIONS_REF,
  getAppActionContext,
  navigateCapsule,
  navigateOutfit = noopNavigateEntity,
  navigateApp,
  navigateNewCapsule,
  navigateNewOutfit = noopNavigateNew,
  pendingShareId,
  setCurrentView,
  setIsSignOutConfirmOpen,
  setSelectedRegenerationUrls,
  shareMetadata,
  sessionActionContext,
}: UseAppHandlersOptions) {
  const { capsuleHandlers, handleNavigateApp, outfitHandlers, sharedHandlers } =
    useMemoizedHandlerInputs({
      activeCapsuleId,
      activeOutfitId,
      getAppActionContext,
      navigateApp,
      navigateCapsule,
      navigateNewCapsule,
      navigateNewOutfit,
      navigateOutfit,
      pendingShareId,
      shareMetadata,
    });

  return useMemo(
    () =>
      buildAppHandlers({
        activeCapsuleId,
        activeOutfitId,
        capsuleSidebarActionsRef,
        outfitSidebarActionsRef,
        getAppActionContext,
        handleNavigateApp,
        sessionActionContext,
        setCurrentView,
        setIsSignOutConfirmOpen,
        setSelectedRegenerationUrls,
        navigateNewCapsule,
        navigateNewOutfit,
        ...capsuleHandlers,
        ...outfitHandlers,
        ...sharedHandlers,
      }),
    [
      activeCapsuleId,
      activeOutfitId,
      capsuleHandlers,
      capsuleSidebarActionsRef,
      getAppActionContext,
      handleNavigateApp,
      navigateNewCapsule,
      navigateNewOutfit,
      outfitHandlers,
      outfitSidebarActionsRef,
      sessionActionContext,
      setCurrentView,
      setIsSignOutConfirmOpen,
      setSelectedRegenerationUrls,
      sharedHandlers,
    ],
  );
}

function useMemoizedHandlerInputs({
  activeCapsuleId,
  activeOutfitId,
  getAppActionContext,
  navigateApp,
  navigateCapsule,
  navigateNewCapsule,
  navigateNewOutfit,
  navigateOutfit,
  pendingShareId,
  shareMetadata,
}: MemoizedHandlerInputOptions) {
  const handleNavigateApp = useCallback(
    (nextApp: Exclude<AppRoute, "share">, options: AppNavigationOptions = {}) =>
      navigateApp(nextApp, options),
    [navigateApp],
  );
  const capsuleHandlers = useMemo(
    () =>
      buildCapsuleHandlerInputs({
        activeCapsuleId,
        getAppActionContext,
        navigateApp,
        navigateCapsule,
        navigateNewCapsule,
      }),
    [
      activeCapsuleId,
      getAppActionContext,
      navigateApp,
      navigateCapsule,
      navigateNewCapsule,
    ],
  );
  const outfitHandlers = useMemo(
    () =>
      buildOutfitHandlerInputs({
        activeOutfitId,
        getAppActionContext,
        navigateApp,
        navigateOutfit,
        navigateNewOutfit,
      }),
    [
      activeOutfitId,
      getAppActionContext,
      navigateApp,
      navigateOutfit,
      navigateNewOutfit,
    ],
  );
  const sharedHandlers = useMemo(
    () =>
      buildSharedHandlerInputs({
        getAppActionContext,
        navigateCapsule,
        pendingShareId,
        shareMetadata,
      }),
    [getAppActionContext, navigateCapsule, pendingShareId, shareMetadata],
  );

  return {
    capsuleHandlers,
    handleNavigateApp,
    outfitHandlers,
    sharedHandlers,
  };
}

function buildCapsuleHandlerInputs({
  activeCapsuleId,
  getAppActionContext,
  navigateApp,
  navigateCapsule,
  navigateNewCapsule,
}: Pick<
  UseAppHandlersOptions,
  | "activeCapsuleId"
  | "getAppActionContext"
  | "navigateApp"
  | "navigateCapsule"
  | "navigateNewCapsule"
>) {
  const handleApplyCapsuleFilters = async () =>
    applyCapsuleFilters(getAppActionContext());
  const handleCreateCapsule = async () => {
    navigateNewCapsule();
  };
  const handleOpenCapsule = async (capsuleId: string) => {
    navigateCapsule(capsuleId);
    void Promise.resolve()
      .then(() => selectCapsule(capsuleId))
      .catch(() => undefined);
  };
  const handleSaveCapsule = async (capsuleId = activeCapsuleId) =>
    saveCurrentCapsule(getAppActionContext(), capsuleId);
  const handleRevertCapsule = async (capsuleId = activeCapsuleId) =>
    revertCurrentCapsule(getAppActionContext(), capsuleId);
  const handleRenameCapsule = async (
    name: string,
    capsuleId = activeCapsuleId,
  ) => renameCurrentCapsule(getAppActionContext(), name, capsuleId);
  const handleSetCapsulePin = async (
    capsuleId: string | undefined,
    pin: boolean,
  ) =>
    setCurrentCapsulePin(
      getAppActionContext(),
      capsuleId || activeCapsuleId,
      pin,
    );
  const handleDuplicateCapsule = async (
    name: string,
    capsuleId = activeCapsuleId,
  ) => {
    const capsule = await duplicateCurrentCapsule(
      getAppActionContext(),
      name,
      capsuleId,
    );
    if (capsule?.id) {
      navigateCapsule(capsule.id, { replace: true });
    }
  };
  const handleDeleteCapsule = async (capsuleId = activeCapsuleId) => {
    await deleteCurrentCapsule(getAppActionContext(), capsuleId);
    if (capsuleId && capsuleId === activeCapsuleId) {
      navigateApp("capsule");
    }
  };

  return {
    handleApplyCapsuleFilters,
    handleCreateCapsule,
    handleDeleteCapsule,
    handleDeleteCapsuleReport: async (capsuleId = activeCapsuleId) =>
      deleteCurrentCapsuleReport(getAppActionContext(), capsuleId),
    handleDuplicateCapsule,
    handleGenerateCapsuleReport: async (capsuleId = activeCapsuleId) =>
      generateCurrentCapsuleReport(getAppActionContext(), capsuleId),
    handleOpenCapsule,
    handleRenameCapsule,
    handleRevertCapsule,
    handleSaveCapsule,
    handleSetCapsulePin,
  };
}

function buildOutfitHandlerInputs({
  activeOutfitId,
  getAppActionContext,
  navigateApp,
  navigateOutfit,
  navigateNewOutfit,
}: Pick<
  UseAppHandlersOptions,
  | "activeOutfitId"
  | "getAppActionContext"
  | "navigateApp"
  | "navigateOutfit"
  | "navigateNewOutfit"
>) {
  const handleCreateOutfit = async () => {
    navigateNewOutfit();
  };
  const handleOpenOutfit = async (outfitId: string) => {
    navigateOutfit(outfitId);
    void Promise.resolve()
      .then(() => selectUserOutfit(outfitId))
      .catch(() => undefined);
  };
  const handleSaveOutfit = async (outfitId = activeOutfitId) =>
    saveCurrentOutfit(getAppActionContext(), outfitId);
  const handleRevertOutfit = async (outfitId = activeOutfitId) =>
    revertCurrentOutfit(getAppActionContext(), outfitId);
  const handleRenameOutfit = async (name: string, outfitId = activeOutfitId) =>
    renameCurrentOutfit(getAppActionContext(), name, outfitId);
  const handleSetOutfitPin = async (
    outfitId: string | undefined,
    pin: boolean,
  ) =>
    setCurrentOutfitPin(getAppActionContext(), outfitId || activeOutfitId, pin);
  const handleDuplicateOutfit = async (
    name: string,
    outfitId = activeOutfitId,
  ) => {
    const outfit = await duplicateCurrentOutfit(
      getAppActionContext(),
      name,
      outfitId,
    );
    if (outfit?.id) {
      navigateOutfit(outfit.id, { replace: true });
    }
  };
  const handleDeleteOutfit = async (outfitId = activeOutfitId) => {
    await deleteCurrentOutfit(getAppActionContext(), outfitId);
    if (outfitId && outfitId === activeOutfitId) {
      navigateApp("capsule");
    }
  };

  return {
    handleCreateOutfit,
    handleDeleteOutfit,
    handleDeleteOutfitReport: async (outfitId = activeOutfitId) =>
      deleteCurrentOutfitReport(getAppActionContext(), outfitId),
    handleDuplicateOutfit,
    handleGenerateOutfitReport: async (outfitId = activeOutfitId) =>
      generateCurrentOutfitReport(getAppActionContext(), outfitId),
    handleOpenOutfit,
    handleRenameOutfit,
    handleRevertOutfit,
    handleSaveOutfit,
    handleSetOutfitPin,
  };
}

function buildSharedHandlerInputs({
  getAppActionContext,
  navigateCapsule,
  pendingShareId,
  shareMetadata,
}: Pick<
  UseAppHandlersOptions,
  "getAppActionContext" | "navigateCapsule" | "pendingShareId" | "shareMetadata"
>) {
  const handleImportSharedCapsule = async () => {
    const capsule = await importSharedCapsuleToApp(
      getAppActionContext(),
      String(shareMetadata?.id || pendingShareId || "").trim(),
    );
    if (capsule?.id) {
      navigateCapsule(capsule.id, { replace: true });
    }
  };

  return { handleImportSharedCapsule };
}
