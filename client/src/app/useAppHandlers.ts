/* eslint-disable max-lines, max-lines-per-function */
import type { FormEvent, MouseEvent } from "react";
import {
  applyCapsuleFilters,
  deleteCurrentCapsule,
  duplicateCurrentCapsule,
  importSharedCapsuleToApp,
  loadMoreRecentCapsules,
  renameCurrentCapsule,
  resetProfileFilters,
  revertCurrentCapsule,
  saveCurrentCapsule,
  searchUserCapsules,
  shareCurrentCapsule,
} from "./capsuleActions";
import {
  copyOutfitSetToOutfits,
  deleteCurrentOutfitReport,
  deleteCurrentOutfitImage,
  deleteCurrentOutfit,
  downloadCurrentOutfitPdf,
  duplicateCurrentOutfit,
  generateCurrentOutfitImage,
  generateCurrentOutfitReport,
  loadMoreRecentOutfits,
  replaceCurrentOutfitItems,
  renameCurrentOutfit,
  revertCurrentOutfit,
  saveCurrentOutfit,
  searchUserOutfits,
  selectUserOutfit,
} from "./outfitActions";
import { selectCapsule } from "../api/capsules";
import { deleteUserProfile, saveSettings } from "./profileActions";
import {
  deleteGeneratedOutfitSetImage,
  downloadWardrobePdf,
  generateOutfitSetImage,
  removeItemFromPersonalItems,
  refreshWardrobe,
  regenerateSelectedItems,
  saveItemToPersonalItems,
  toggleRegenerationSelection,
  updateUploadedItemInPersonalItems,
} from "./wardrobeActions";
import {
  googleCredential,
  passkeySignIn,
  requestCode,
  resetToEmail,
  signOut,
  type SessionActionContext,
  verifyCode,
} from "./sessionActions";
import type { AppActionContext } from "./actionContext";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleSidebarActions,
  OutfitSidebarActions,
  OutfitItemSnapshot,
  WardrobeItem,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import type { UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import { setItemLike } from "./likedItemActions";

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

export function useAppHandlers({
  activeCapsuleId,
  activeOutfitId = "",
  capsuleSidebarActionsRef,
  outfitSidebarActionsRef = { current: null },
  getAppActionContext,
  navigateCapsule,
  navigateOutfit = () => {},
  navigateApp,
  navigateNewCapsule,
  navigateNewOutfit = () => {},
  pendingShareId,
  setCurrentView,
  setIsSignOutConfirmOpen,
  setSelectedRegenerationUrls,
  shareMetadata,
  sessionActionContext,
}: UseAppHandlersOptions) {
  const handleNavigateApp = (
    nextApp: Exclude<AppRoute, "share">,
    options: AppNavigationOptions = {},
  ) => {
    navigateApp(nextApp, options);
  };
  const handleApplyCapsuleFilters = async () =>
    applyCapsuleFilters(getAppActionContext());
  const handleCreateCapsule = async () => {
    navigateNewCapsule();
  };
  const handleCreateOutfit = async () => {
    navigateNewOutfit();
  };
  const handleOpenCapsule = async (capsuleId: string) => {
    await selectCapsule(capsuleId);
    navigateCapsule(capsuleId);
  };
  const handleOpenOutfit = async (outfitId: string) => {
    await selectUserOutfit(outfitId);
    navigateOutfit(outfitId);
  };
  const handleSaveCapsule = async (capsuleId = activeCapsuleId) =>
    saveCurrentCapsule(getAppActionContext(), capsuleId);
  const handleRevertCapsule = async (capsuleId = activeCapsuleId) =>
    revertCurrentCapsule(getAppActionContext(), capsuleId);
  const handleRenameCapsule = async (
    name: string,
    capsuleId = activeCapsuleId,
  ) => renameCurrentCapsule(getAppActionContext(), name, capsuleId);
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
  const handleSaveOutfit = async (outfitId = activeOutfitId) =>
    saveCurrentOutfit(getAppActionContext(), outfitId);
  const handleRevertOutfit = async (outfitId = activeOutfitId) =>
    revertCurrentOutfit(getAppActionContext(), outfitId);
  const handleRenameOutfit = async (name: string, outfitId = activeOutfitId) =>
    renameCurrentOutfit(getAppActionContext(), name, outfitId);
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
  const handleCopyOutfitSetToOutfits = async (
    name: string,
    items: Record<string, unknown>[],
    source?: { capsuleId?: string; setIndex?: number | string },
  ) => copyOutfitSetToOutfits(getAppActionContext(), name, items, source);
  const handleImportSharedCapsule = async () => {
    const capsule = await importSharedCapsuleToApp(
      getAppActionContext(),
      String(shareMetadata?.id || pendingShareId || "").trim(),
    );
    if (capsule?.id) {
      navigateCapsule(capsule.id, { replace: true });
    }
  };

  return buildAppHandlers({
    activeCapsuleId,
    activeOutfitId,
    capsuleSidebarActionsRef,
    outfitSidebarActionsRef,
    getAppActionContext,
    handleApplyCapsuleFilters,
    handleCreateCapsule,
    handleCreateOutfit,
    handleDeleteCapsule,
    handleDeleteOutfit,
    handleDeleteOutfitImage: async (outfitId = activeOutfitId) =>
      deleteCurrentOutfitImage(getAppActionContext(), outfitId),
    handleDeleteOutfitReport: async (outfitId = activeOutfitId) =>
      deleteCurrentOutfitReport(getAppActionContext(), outfitId),
    handleDuplicateCapsule,
    handleDuplicateOutfit,
    handleCopyOutfitSetToOutfits,
    handleImportSharedCapsule,
    handleGenerateOutfitReport: async (outfitId = activeOutfitId) =>
      generateCurrentOutfitReport(getAppActionContext(), outfitId),
    handleNavigateApp,
    handleOpenCapsule,
    handleOpenOutfit,
    handleRenameCapsule,
    handleRenameOutfit,
    handleRevertCapsule,
    handleRevertOutfit,
    handleSaveCapsule,
    handleSaveOutfit,
    sessionActionContext,
    setCurrentView,
    setIsSignOutConfirmOpen,
    setSelectedRegenerationUrls,
    navigateNewCapsule,
    navigateNewOutfit,
  });
}

type BuildAppHandlersOptions = Pick<
  UseAppHandlersOptions,
  | "activeCapsuleId"
  | "activeOutfitId"
  | "capsuleSidebarActionsRef"
  | "outfitSidebarActionsRef"
  | "getAppActionContext"
  | "sessionActionContext"
  | "setCurrentView"
  | "setIsSignOutConfirmOpen"
  | "setSelectedRegenerationUrls"
  | "navigateNewCapsule"
  | "navigateNewOutfit"
> & {
  handleApplyCapsuleFilters: () => Promise<void>;
  handleCreateCapsule: () => Promise<void>;
  handleCreateOutfit: () => Promise<void>;
  handleDeleteCapsule: (capsuleId?: string) => Promise<void>;
  handleDeleteOutfit: (outfitId?: string) => Promise<void>;
  handleDeleteOutfitImage: (outfitId?: string) => Promise<void>;
  handleDeleteOutfitReport: (outfitId?: string) => Promise<void>;
  handleDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  handleDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  handleCopyOutfitSetToOutfits: (
    name: string,
    items: Record<string, unknown>[],
    source?: { capsuleId?: string; setIndex?: number | string },
  ) => Promise<{ id?: string; name?: string } | null>;
  handleImportSharedCapsule: () => Promise<void>;
  handleGenerateOutfitReport: (outfitId?: string) => Promise<void>;
  handleNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  handleOpenCapsule: (capsuleId: string) => Promise<void>;
  handleOpenOutfit: (outfitId: string) => Promise<void>;
  handleRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  handleRenameOutfit: (name: string, outfitId?: string) => Promise<void>;
  handleRevertCapsule: (capsuleId?: string) => Promise<void>;
  handleRevertOutfit: (outfitId?: string) => Promise<void>;
  handleSaveCapsule: (capsuleId?: string) => Promise<void>;
  handleSaveOutfit: (outfitId?: string) => Promise<void>;
};

function buildAppHandlers({
  activeCapsuleId,
  activeOutfitId,
  capsuleSidebarActionsRef,
  outfitSidebarActionsRef,
  getAppActionContext,
  handleApplyCapsuleFilters,
  handleCreateCapsule,
  handleCreateOutfit,
  handleDeleteCapsule,
  handleDeleteOutfit,
  handleDeleteOutfitImage,
  handleDeleteOutfitReport,
  handleDuplicateCapsule,
  handleDuplicateOutfit,
  handleCopyOutfitSetToOutfits,
  handleImportSharedCapsule,
  handleGenerateOutfitReport,
  handleNavigateApp,
  handleOpenCapsule,
  handleOpenOutfit,
  navigateNewCapsule,
  navigateNewOutfit,
  handleRenameCapsule,
  handleRenameOutfit,
  handleRevertCapsule,
  handleRevertOutfit,
  handleSaveCapsule,
  handleSaveOutfit,
  sessionActionContext,
  setCurrentView,
  setIsSignOutConfirmOpen,
  setSelectedRegenerationUrls,
}: BuildAppHandlersOptions) {
  return {
    handleApplyCapsuleFilters,
    handleBackToMain: () => setCurrentView("main"),
    handleCancelRegenerationSelection: () => setSelectedRegenerationUrls([]),
    handleCreateCapsule,
    handleCreateCapsuleFromSidebar: async (onComplete?: () => void) => {
      navigateNewCapsule();
      onComplete?.();
    },
    handleCreateOutfit,
    handleCreateOutfitFromSidebar: async (onComplete?: () => void) => {
      navigateNewOutfit();
      onComplete?.();
    },
    handleDeleteCapsule,
    handleDeleteOutfit,
    handleDeleteOutfitImage,
    handleDeleteOutfitReport,
    handleCopyOutfitSetToOutfits,
    handleDeleteOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => deleteGeneratedOutfitSetImage(getAppActionContext(), setIndex),
    handleDeleteProfile: async () =>
      deleteUserProfile(getAppActionContext(), sessionActionContext),
    handleDownloadWardrobePdf: async (capsuleId = activeCapsuleId) =>
      downloadWardrobePdf(getAppActionContext(), capsuleId),
    handleDownloadOutfitPdf: async (outfitId = activeOutfitId) =>
      downloadCurrentOutfitPdf(getAppActionContext(), outfitId),
    handleDuplicateCapsule,
    handleDuplicateOutfit,
    handleGenerateOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => generateOutfitSetImage(getAppActionContext(), setIndex),
    handleGenerateOutfitImage: async (outfitId = activeOutfitId) =>
      generateCurrentOutfitImage(getAppActionContext(), outfitId),
    handleGenerateOutfitReport,
    handleGoogleCredential: async (idToken: string) =>
      googleCredential(sessionActionContext, idToken),
    handleImportSharedCapsule,
    handleNavigateApp,
    handleOpenCapsule,
    handleLoadMoreCapsules: async () =>
      loadMoreRecentCapsules(getAppActionContext()),
    handleLoadMoreOutfits: async () =>
      loadMoreRecentOutfits(getAppActionContext()),
    handleOpenOutfit,
    handleOpenCapsuleFromSidebar: async (
      capsuleId: string,
      onComplete?: () => void,
    ) => {
      await handleOpenCapsule(capsuleId);
      onComplete?.();
    },
    handleOpenOutfitFromSidebar: async (
      outfitId: string,
      onComplete?: () => void,
    ) => {
      await handleOpenOutfit(outfitId);
      onComplete?.();
    },
    handlePasskeySignIn: async () => passkeySignIn(sessionActionContext),
    handleRefreshWardrobe: async () => refreshWardrobe(getAppActionContext()),
    handleReplaceOutfitItems: async (
      outfitId: string,
      items: OutfitItemSnapshot[],
    ) => replaceCurrentOutfitItems(getAppActionContext(), outfitId, items),
    handleRegenerateSelectedItems: async () =>
      regenerateSelectedItems(getAppActionContext()),
    handleRenameCapsule,
    handleRenameOutfit,
    handleRequestCode: async (
      event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
    ) => requestCode(sessionActionContext, event),
    handleRequestSignOut: () => setIsSignOutConfirmOpen(true),
    handleResetProfileFilters: async () =>
      resetProfileFilters(getAppActionContext()),
    handleRevertCapsule,
    handleRevertOutfit,
    handleSaveCapsule,
    handleSaveOutfit,
    handleRemoveFromPersonalItems: async (item: WardrobeItem) =>
      removeItemFromPersonalItems(getAppActionContext(), item),
    handleSaveToPersonalItems: async (item: WardrobeItem) =>
      saveItemToPersonalItems(getAppActionContext(), item),
    handleSetItemLike: async (item: WardrobeItem, isLiked: boolean) =>
      setItemLike(getAppActionContext(), item, isLiked),
    handleUpdateUploadedWardrobeItem: async (
      item: WardrobeItem,
      payload: UploadedWardrobeItemUpdatePayload,
    ) =>
      updateUploadedItemInPersonalItems(getAppActionContext(), item, payload),
    handleSaveProfile: async () => handleApplyCapsuleFilters(),
    handleSaveSettings: async (nextSettings: SettingsSavePayload) =>
      saveSettings(getAppActionContext(), nextSettings),
    handleSearchCapsules: async (query: string) => searchUserCapsules(query),
    handleSearchOutfits: async (query: string) => searchUserOutfits(query),
    handleShareCapsule: async (capsuleId = activeCapsuleId) =>
      shareCurrentCapsule(getAppActionContext(), capsuleId),
    handleToggleRegenerationSelection: (item: WardrobeItem) =>
      toggleRegenerationSelection(getAppActionContext(), item),
    handleVerifyCode: async (event: FormEvent<HTMLFormElement>) =>
      verifyCode(sessionActionContext, event),
    registerCapsuleSidebarActions: (actions: CapsuleSidebarActions | null) => {
      capsuleSidebarActionsRef.current = actions;
    },
    registerOutfitSidebarActions: (actions: OutfitSidebarActions | null) => {
      outfitSidebarActionsRef.current = actions;
    },
    resetToEmail: () => resetToEmail(sessionActionContext),
    signOut: async () => signOut(sessionActionContext),
  };
}
