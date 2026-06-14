import type { FormEvent, MouseEvent } from "react";
import type { AppActionContext } from "./actionContext";
import type {
  AppNavigationOptions,
  AppRoute,
  CapsuleSidebarActions,
  OutfitItemSnapshot,
  OutfitSidebarActions,
  WardrobeItem,
} from "./appTypes";
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
import { deleteUserProfile, saveSettings } from "./profileActions";
import {
  googleCredential,
  passkeySignIn,
  requestCode,
  resetToEmail,
  signOut,
  type SessionActionContext,
  verifyCode,
} from "./sessionActions";
import {
  copyOutfitSetToOutfits,
  deleteCurrentOutfitImage,
  downloadCurrentOutfitPdf,
  generateCurrentOutfitImage,
  loadMoreRecentOutfits,
  replaceCurrentOutfitItems,
  searchUserOutfits,
} from "./outfitActions";
import {
  loadMoreRecentCapsules,
  resetProfileFilters,
  searchUserCapsules,
  shareCurrentCapsule,
} from "./capsuleActions";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import type { UploadedWardrobeItemUpdatePayload } from "../api/personalItems";
import { setItemLike } from "./likedItemActions";

type AppHandlerBuilderOptions = {
  activeCapsuleId: string;
  activeOutfitId: string;
  capsuleSidebarActionsRef: { current: CapsuleSidebarActions | null };
  outfitSidebarActionsRef: { current: OutfitSidebarActions | null };
  getAppActionContext: () => AppActionContext;
  handleApplyCapsuleFilters: () => Promise<void>;
  handleCreateCapsule: () => Promise<void>;
  handleCreateOutfit: () => Promise<void>;
  handleDeleteCapsule: (capsuleId?: string) => Promise<void>;
  handleDeleteCapsuleReport: (capsuleId?: string) => Promise<void>;
  handleDeleteOutfit: (outfitId?: string) => Promise<void>;
  handleDeleteOutfitReport: (outfitId?: string) => Promise<void>;
  handleDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  handleDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  handleGenerateCapsuleReport: (capsuleId?: string) => Promise<void>;
  handleGenerateOutfitReport: (outfitId?: string) => Promise<void>;
  handleImportSharedCapsule: () => Promise<void>;
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
  navigateNewCapsule: (options?: { replace?: boolean }) => void;
  navigateNewOutfit: (options?: { replace?: boolean }) => void;
  sessionActionContext: SessionActionContext;
  setCurrentView: (view: string) => void;
  setIsSignOutConfirmOpen: (open: boolean) => void;
  setSelectedRegenerationUrls: (urls: string[]) => void;
};

function buildAppHandlers(options: AppHandlerBuilderOptions) {
  return {
    ...buildCoreHandlers(options),
    ...buildCapsuleHandlers(options),
    ...buildOutfitHandlers(options),
    ...buildWardrobeHandlers(options),
    ...buildProfileSessionHandlers(options),
    ...buildSidebarRegistrationHandlers(options),
  };
}

function buildCoreHandlers({
  handleApplyCapsuleFilters,
  handleCreateCapsule,
  handleCreateOutfit,
  handleImportSharedCapsule,
  handleNavigateApp,
  setCurrentView,
  setSelectedRegenerationUrls,
}: AppHandlerBuilderOptions) {
  return {
    handleApplyCapsuleFilters,
    handleBackToMain: () => setCurrentView("main"),
    handleCancelRegenerationSelection: () => setSelectedRegenerationUrls([]),
    handleCreateCapsule,
    handleCreateOutfit,
    handleImportSharedCapsule,
    handleNavigateApp,
  };
}

function buildCapsuleHandlers({
  activeCapsuleId,
  getAppActionContext,
  handleApplyCapsuleFilters,
  handleDeleteCapsule,
  handleDeleteCapsuleReport,
  handleDuplicateCapsule,
  handleGenerateCapsuleReport,
  handleOpenCapsule,
  handleRenameCapsule,
  handleRevertCapsule,
  handleSaveCapsule,
  navigateNewCapsule,
}: AppHandlerBuilderOptions) {
  return {
    handleCreateCapsuleFromSidebar: async (onComplete?: () => void) => {
      navigateNewCapsule();
      onComplete?.();
    },
    handleDeleteCapsule,
    handleDeleteCapsuleReport,
    handleDuplicateCapsule,
    handleDownloadWardrobePdf: async (capsuleId = activeCapsuleId) =>
      downloadWardrobePdf(getAppActionContext(), capsuleId),
    handleGenerateCapsuleReport,
    handleLoadMoreCapsules: async () =>
      loadMoreRecentCapsules(getAppActionContext()),
    handleOpenCapsule,
    handleOpenCapsuleFromSidebar: async (
      capsuleId: string,
      onComplete?: () => void,
    ) => {
      void handleOpenCapsule(capsuleId).catch(() => undefined);
      onComplete?.();
    },
    handleRenameCapsule,
    handleResetProfileFilters: async () =>
      resetProfileFilters(getAppActionContext()),
    handleRevertCapsule,
    handleSaveCapsule,
    handleSaveProfile: async () => handleApplyCapsuleFilters(),
    handleSearchCapsules: async (query: string) => searchUserCapsules(query),
    handleShareCapsule: async (capsuleId = activeCapsuleId) =>
      shareCurrentCapsule(getAppActionContext(), capsuleId),
  };
}

function buildOutfitHandlers({
  activeOutfitId,
  getAppActionContext,
  handleDeleteOutfit,
  handleDeleteOutfitReport,
  handleDuplicateOutfit,
  handleGenerateOutfitReport,
  handleOpenOutfit,
  handleRenameOutfit,
  handleRevertOutfit,
  handleSaveOutfit,
  navigateNewOutfit,
}: AppHandlerBuilderOptions) {
  return {
    handleCreateOutfitFromSidebar: async (onComplete?: () => void) => {
      navigateNewOutfit();
      onComplete?.();
    },
    handleDeleteOutfit,
    handleDeleteOutfitImage: async (outfitId = activeOutfitId) =>
      deleteCurrentOutfitImage(getAppActionContext(), outfitId),
    handleDeleteOutfitReport,
    handleDuplicateOutfit,
    handleDownloadOutfitPdf: async (outfitId = activeOutfitId) =>
      downloadCurrentOutfitPdf(getAppActionContext(), outfitId),
    handleGenerateOutfitImage: async (outfitId = activeOutfitId) =>
      generateCurrentOutfitImage(getAppActionContext(), outfitId),
    handleGenerateOutfitReport,
    handleLoadMoreOutfits: async () =>
      loadMoreRecentOutfits(getAppActionContext()),
    handleOpenOutfit,
    handleOpenOutfitFromSidebar: async (
      outfitId: string,
      onComplete?: () => void,
    ) => {
      void handleOpenOutfit(outfitId).catch(() => undefined);
      onComplete?.();
    },
    handleRenameOutfit,
    handleReplaceOutfitItems: async (
      outfitId: string,
      items: OutfitItemSnapshot[],
    ) => replaceCurrentOutfitItems(getAppActionContext(), outfitId, items),
    handleRevertOutfit,
    handleSaveOutfit,
    handleSearchOutfits: async (query: string) => searchUserOutfits(query),
  };
}

function buildWardrobeHandlers({
  getAppActionContext,
}: AppHandlerBuilderOptions) {
  return {
    handleCopyOutfitSetToOutfits: async (
      name: string,
      items: Record<string, unknown>[],
      source?: { capsuleId?: string; setIndex?: number | string },
    ) => copyOutfitSetToOutfits(getAppActionContext(), name, items, source),
    handleDeleteOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => deleteGeneratedOutfitSetImage(getAppActionContext(), setIndex),
    handleGenerateOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => generateOutfitSetImage(getAppActionContext(), setIndex),
    handleRefreshWardrobe: async () => refreshWardrobe(getAppActionContext()),
    handleRegenerateSelectedItems: async () =>
      regenerateSelectedItems(getAppActionContext()),
    handleRemoveFromPersonalItems: async (item: WardrobeItem) =>
      removeItemFromPersonalItems(getAppActionContext(), item),
    handleSaveToPersonalItems: async (item: WardrobeItem) =>
      saveItemToPersonalItems(getAppActionContext(), item),
    handleSetItemLike: async (item: WardrobeItem, isLiked: boolean) =>
      setItemLike(getAppActionContext(), item, isLiked),
    handleToggleRegenerationSelection: (item: WardrobeItem) =>
      toggleRegenerationSelection(getAppActionContext(), item),
    handleUpdateUploadedWardrobeItem: async (
      item: WardrobeItem,
      payload: UploadedWardrobeItemUpdatePayload,
    ) =>
      updateUploadedItemInPersonalItems(getAppActionContext(), item, payload),
  };
}

function buildProfileSessionHandlers({
  getAppActionContext,
  sessionActionContext,
  setIsSignOutConfirmOpen,
}: AppHandlerBuilderOptions) {
  return {
    handleDeleteProfile: async () =>
      deleteUserProfile(getAppActionContext(), sessionActionContext),
    handleGoogleCredential: async (idToken: string) =>
      googleCredential(sessionActionContext, idToken),
    handlePasskeySignIn: async () => passkeySignIn(sessionActionContext),
    handleRequestCode: async (
      event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
    ) => requestCode(sessionActionContext, event),
    handleRequestSignOut: () => setIsSignOutConfirmOpen(true),
    handleSaveSettings: async (nextSettings: SettingsSavePayload) =>
      saveSettings(getAppActionContext(), nextSettings),
    handleVerifyCode: async (event: FormEvent<HTMLFormElement>) =>
      verifyCode(sessionActionContext, event),
    resetToEmail: () => resetToEmail(sessionActionContext),
    signOut: async () => signOut(sessionActionContext),
  };
}

function buildSidebarRegistrationHandlers({
  capsuleSidebarActionsRef,
  outfitSidebarActionsRef,
}: AppHandlerBuilderOptions) {
  return {
    registerCapsuleSidebarActions: (actions: CapsuleSidebarActions | null) => {
      capsuleSidebarActionsRef.current = actions;
    },
    registerOutfitSidebarActions: (actions: OutfitSidebarActions | null) => {
      outfitSidebarActionsRef.current = actions;
    },
  };
}

export { buildAppHandlers };
