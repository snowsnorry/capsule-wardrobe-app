import type { FormEvent, MouseEvent } from "react";
import {
  applyCapsuleFilters,
  createNewCapsule,
  deleteCurrentCapsule,
  duplicateCurrentCapsule,
  importSharedCapsuleToApp,
  openCapsule,
  renameCurrentCapsule,
  resetProfileFilters,
  revertCurrentCapsule,
  saveCurrentCapsule,
  searchUserCapsules,
  shareCurrentCapsule,
} from "./capsuleActions";
import {
  backOnboarding,
  deleteUserProfile,
  finishOnboarding,
  nextOnboarding,
  saveSettings,
} from "./profileActions";
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

type UseAppHandlersOptions = {
  activeCapsuleId: string;
  capsuleSidebarActionsRef: { current: CapsuleSidebarActions | null };
  getAppActionContext: () => AppActionContext;
  navigateApp: (
    nextApp: Exclude<AppRoute, "share">,
    options?: AppNavigationOptions,
  ) => void;
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
  navigateApp,
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
  const handleCreateCapsule = async () =>
    createNewCapsule(getAppActionContext());
  const handleOpenCapsule = async (capsuleId: string) =>
    openCapsule(getAppActionContext(), capsuleId);
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
  ) => duplicateCurrentCapsule(getAppActionContext(), name, capsuleId);
  const handleDeleteCapsule = async (capsuleId = activeCapsuleId) =>
    deleteCurrentCapsule(getAppActionContext(), capsuleId);
  const handleImportSharedCapsule = async () =>
    importSharedCapsuleToApp(
      getAppActionContext(),
      String(shareMetadata?.id || pendingShareId || "").trim(),
    );

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
    handleBackOnboarding: () => backOnboarding(getAppActionContext()),
    handleBackToMain: () => setCurrentView("main"),
    handleCancelRegenerationSelection: () => setSelectedRegenerationUrls([]),
    handleCreateCapsule,
    handleCreateCapsuleFromSidebar: async (onComplete?: () => void) => {
      await handleCreateCapsule();
      handleNavigateApp("capsule");
      onComplete?.();
    },
    handleDeleteCapsule,
    handleDeleteOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => deleteGeneratedOutfitSetImage(getAppActionContext(), setIndex),
    handleDeleteProfile: async () => deleteUserProfile(getAppActionContext()),
    handleDownloadWardrobePdf: async (capsuleId = activeCapsuleId) =>
      downloadWardrobePdf(getAppActionContext(), capsuleId),
    handleDuplicateCapsule,
    handleFinishOnboarding: async () => finishOnboarding(getAppActionContext()),
    handleGenerateOutfitSetImage: async (
      setIndex: number | string | null | undefined,
    ) => generateOutfitSetImage(getAppActionContext(), setIndex),
    handleGoogleCredential: async (idToken: string) =>
      googleCredential(sessionActionContext, idToken),
    handleImportSharedCapsule,
    handleNavigateApp,
    handleNextOnboarding: () => nextOnboarding(getAppActionContext()),
    handleOpenCapsule,
    handleOpenCapsuleFromSidebar: async (
      capsuleId: string,
      onComplete?: () => void,
    ) => {
      handleNavigateApp("capsule");
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
