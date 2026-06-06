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
import { selectCapsule } from "../api/capsules";
import { deleteUserProfile, saveSettings } from "./profileActions";
import {
  deleteGeneratedOutfitSetImage,
  downloadWardrobePdf,
  generateOutfitSetImage,
  removeItemFromMyWardrobe,
  refreshWardrobe,
  regenerateSelectedItems,
  saveItemToMyWardrobe,
  toggleRegenerationSelection,
  updateUploadedItemInMyWardrobe,
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
  WardrobeItem,
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";
import type { UploadedWardrobeItemUpdatePayload } from "../api/myWardrobe";
import { setItemLike } from "./likedItemActions";

type UseAppHandlersOptions = {
  activeCapsuleId: string;
  capsuleSidebarActionsRef: { current: CapsuleSidebarActions | null };
  getAppActionContext: () => AppActionContext;
  navigateCapsule: (capsuleId: string, options?: { replace?: boolean }) => void;
  navigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  navigateNewCapsule: (options?: { replace?: boolean }) => void;
  pendingShareId: string;
  setCurrentView: (view: string) => void;
  setIsSignOutConfirmOpen: (open: boolean) => void;
  setSelectedRegenerationUrls: (urls: string[]) => void;
  shareMetadata: { id?: string } | null;
  sessionActionContext: SessionActionContext;
};

export function useAppHandlers({
  activeCapsuleId,
  capsuleSidebarActionsRef,
  getAppActionContext,
  navigateCapsule,
  navigateApp,
  navigateNewCapsule,
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
  const handleOpenCapsule = async (capsuleId: string) => {
    await selectCapsule(capsuleId);
    navigateCapsule(capsuleId);
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
    capsuleSidebarActionsRef,
    getAppActionContext,
    handleApplyCapsuleFilters,
    handleCreateCapsule,
    handleDeleteCapsule,
    handleDuplicateCapsule,
    handleImportSharedCapsule,
    handleNavigateApp,
    handleOpenCapsule,
    handleRenameCapsule,
    handleRevertCapsule,
    handleSaveCapsule,
    sessionActionContext,
    setCurrentView,
    setIsSignOutConfirmOpen,
    setSelectedRegenerationUrls,
    navigateNewCapsule,
  });
}

type BuildAppHandlersOptions = Pick<
  UseAppHandlersOptions,
  | "activeCapsuleId"
  | "capsuleSidebarActionsRef"
  | "getAppActionContext"
  | "sessionActionContext"
  | "setCurrentView"
  | "setIsSignOutConfirmOpen"
  | "setSelectedRegenerationUrls"
  | "navigateNewCapsule"
> & {
  handleApplyCapsuleFilters: () => Promise<void>;
  handleCreateCapsule: () => Promise<void>;
  handleDeleteCapsule: (capsuleId?: string) => Promise<void>;
  handleDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  handleImportSharedCapsule: () => Promise<void>;
  handleNavigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
  handleOpenCapsule: (capsuleId: string) => Promise<void>;
  handleRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  handleRevertCapsule: (capsuleId?: string) => Promise<void>;
  handleSaveCapsule: (capsuleId?: string) => Promise<void>;
};

// eslint-disable-next-line max-lines-per-function
function buildAppHandlers({
  activeCapsuleId,
  capsuleSidebarActionsRef,
  getAppActionContext,
  handleApplyCapsuleFilters,
  handleCreateCapsule,
  handleDeleteCapsule,
  handleDuplicateCapsule,
  handleImportSharedCapsule,
  handleNavigateApp,
  handleOpenCapsule,
  navigateNewCapsule,
  handleRenameCapsule,
  handleRevertCapsule,
  handleSaveCapsule,
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
    handleDeleteCapsule,
    handleDeleteOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => deleteGeneratedOutfitSetImage(getAppActionContext(), setIndex),
    handleDeleteProfile: async () =>
      deleteUserProfile(getAppActionContext(), sessionActionContext),
    handleDownloadWardrobePdf: async (capsuleId = activeCapsuleId) =>
      downloadWardrobePdf(getAppActionContext(), capsuleId),
    handleDuplicateCapsule,
    handleGenerateOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => generateOutfitSetImage(getAppActionContext(), setIndex),
    handleGoogleCredential: async (idToken: string) =>
      googleCredential(sessionActionContext, idToken),
    handleImportSharedCapsule,
    handleNavigateApp,
    handleOpenCapsule,
    handleLoadMoreCapsules: async () =>
      loadMoreRecentCapsules(getAppActionContext()),
    handleOpenCapsuleFromSidebar: async (
      capsuleId: string,
      onComplete?: () => void,
    ) => {
      await handleOpenCapsule(capsuleId);
      onComplete?.();
    },
    handlePasskeySignIn: async () => passkeySignIn(sessionActionContext),
    handleRefreshWardrobe: async () => refreshWardrobe(getAppActionContext()),
    handleRegenerateSelectedItems: async () =>
      regenerateSelectedItems(getAppActionContext()),
    handleRenameCapsule,
    handleRequestCode: async (
      event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
    ) => requestCode(sessionActionContext, event),
    handleRequestSignOut: () => setIsSignOutConfirmOpen(true),
    handleResetProfileFilters: async () =>
      resetProfileFilters(getAppActionContext()),
    handleRevertCapsule,
    handleSaveCapsule,
    handleRemoveFromMyWardrobe: async (item: WardrobeItem) =>
      removeItemFromMyWardrobe(getAppActionContext(), item),
    handleSaveToMyWardrobe: async (item: WardrobeItem) =>
      saveItemToMyWardrobe(getAppActionContext(), item),
    handleSetItemLike: async (item: WardrobeItem, isLiked: boolean) =>
      setItemLike(getAppActionContext(), item, isLiked),
    handleUpdateUploadedWardrobeItem: async (
      item: WardrobeItem,
      payload: UploadedWardrobeItemUpdatePayload,
    ) => updateUploadedItemInMyWardrobe(getAppActionContext(), item, payload),
    handleSaveProfile: async () => handleApplyCapsuleFilters(),
    handleSaveSettings: async (nextSettings: SettingsSavePayload) =>
      saveSettings(getAppActionContext(), nextSettings),
    handleSearchCapsules: async (query: string) => searchUserCapsules(query),
    handleShareCapsule: async (capsuleId = activeCapsuleId) =>
      shareCurrentCapsule(getAppActionContext(), capsuleId),
    handleToggleRegenerationSelection: (item: WardrobeItem) =>
      toggleRegenerationSelection(getAppActionContext(), item),
    handleVerifyCode: async (event: FormEvent<HTMLFormElement>) =>
      verifyCode(sessionActionContext, event),
    registerCapsuleSidebarActions: (actions: CapsuleSidebarActions | null) => {
      capsuleSidebarActionsRef.current = actions;
    },
    resetToEmail: () => resetToEmail(sessionActionContext),
    signOut: async () => signOut(sessionActionContext),
  };
}
