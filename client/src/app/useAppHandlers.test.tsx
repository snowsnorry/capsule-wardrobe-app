import { describe, expect, test, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createActionContext } from "./testUtils";
import { useAppHandlers } from "./useAppHandlers";
import type { SessionActionContext } from "./sessionActions";

const capsuleActions = vi.hoisted(() => ({
  applyCapsuleFilters: vi.fn(),
  createNewCapsule: vi.fn(),
  deleteCurrentCapsule: vi.fn(),
  duplicateCurrentCapsule: vi.fn(),
  importSharedCapsuleToApp: vi.fn(),
  openCapsule: vi.fn(),
  renameCurrentCapsule: vi.fn(),
  resetProfileFilters: vi.fn(),
  revertCurrentCapsule: vi.fn(),
  saveCurrentCapsule: vi.fn(),
  searchUserCapsules: vi.fn(),
  shareCurrentCapsule: vi.fn(),
}));
const profileActions = vi.hoisted(() => ({
  deleteUserProfile: vi.fn(),
  saveSettings: vi.fn(),
}));
const wardrobeActions = vi.hoisted(() => ({
  deleteGeneratedOutfitSetImage: vi.fn(),
  downloadWardrobePdf: vi.fn(),
  generateOutfitSetImage: vi.fn(),
  removeItemFromMyWardrobe: vi.fn(),
  refreshWardrobe: vi.fn(),
  regenerateSelectedItems: vi.fn(),
  saveItemToMyWardrobe: vi.fn(),
  toggleRegenerationSelection: vi.fn(),
  updateUploadedItemInMyWardrobe: vi.fn(),
}));
const sessionActions = vi.hoisted(() => ({
  googleCredential: vi.fn(),
  passkeySignIn: vi.fn(),
  requestCode: vi.fn(),
  resetToEmail: vi.fn(),
  signOut: vi.fn(),
  verifyCode: vi.fn(),
}));

vi.mock("./capsuleActions", () => capsuleActions);
vi.mock("./profileActions", () => profileActions);
vi.mock("./wardrobeActions", () => wardrobeActions);
vi.mock("./sessionActions", () => sessionActions);

function createSessionContext(): SessionActionContext {
  return {
    bootstrapCapsules: vi.fn(),
    closeNotificationPrompt: vi.fn(),
    code: "123456",
    email: "person@example.com",
    ensureOptionsLoaded: vi.fn(),
    locale: "en",
    maybeShowPasskeyPrompt: vi.fn(),
    resetCapsuleState: vi.fn(),
    resetNavigation: vi.fn(),
    resetProfileOptions: vi.fn(),
    resetSessionState: vi.fn(),
    resolveErrorMessage: vi.fn(),
    retry: vi.fn(),
    setCode: vi.fn(),
    setHasProfile: vi.fn(),
    setIsSignOutConfirmOpen: vi.fn(),
    setProfileCreated: vi.fn(),
    setSettingsProfile: vi.fn(),
    setStatus: vi.fn(),
    setStep: vi.fn(),
    setUser: vi.fn(),
  };
}

describe("useAppHandlers", () => {
  test("wires app, capsule, wardrobe, profile, and session handlers", async () => {
    const actionContext = createActionContext();
    const sessionActionContext = createSessionContext();
    const navigateApp = vi.fn();
    const setCurrentView = vi.fn();
    const setIsSignOutConfirmOpen = vi.fn();
    const setSelectedRegenerationUrls = vi.fn();
    const capsuleSidebarActionsRef = { current: null };
    capsuleActions.searchUserCapsules.mockResolvedValue([{ id: "capsule-2" }]);
    capsuleActions.shareCurrentCapsule.mockResolvedValue({
      url: "https://share.example.test",
    });

    const { result } = renderHook(() =>
      useAppHandlers({
        activeCapsuleId: "capsule-1",
        capsuleSidebarActionsRef,
        getAppActionContext: () => actionContext,
        navigateApp,
        pendingShareId: "share-pending",
        setCurrentView,
        setIsSignOutConfirmOpen,
        setSelectedRegenerationUrls,
        shareMetadata: { id: "share-meta" },
        sessionActionContext,
      }),
    );

    result.current.handleNavigateApp("explore", { query: "linen" });
    result.current.handleBackToMain();
    result.current.handleCancelRegenerationSelection();
    await result.current.handleApplyCapsuleFilters();
    await result.current.handleCreateCapsuleFromSidebar();
    await result.current.handleOpenCapsuleFromSidebar("capsule-2");
    await result.current.handleSaveCapsule();
    await result.current.handleRevertCapsule();
    await result.current.handleRenameCapsule("Renamed");
    await result.current.handleDuplicateCapsule("Copy");
    await result.current.handleDeleteCapsule();
    await result.current.handleImportSharedCapsule();
    await result.current.handleDeleteOutfitSetImage(1);
    await result.current.handleDeleteProfile();
    await result.current.handleDownloadWardrobePdf();
    await result.current.handleGenerateOutfitSetImage(2);
    await result.current.handleGoogleCredential("token");
    await result.current.handlePasskeySignIn();
    await result.current.handleRefreshWardrobe();
    await result.current.handleRegenerateSelectedItems();
    await result.current.handleRequestCode({
      preventDefault: vi.fn(),
    } as never);
    result.current.handleRequestSignOut();
    await result.current.handleResetProfileFilters();
    await result.current.handleSaveProfile();
    await result.current.handleRemoveFromMyWardrobe({
      url: "https://example.com/top",
    });
    await result.current.handleSaveToMyWardrobe({
      url: "https://example.com/top",
    });
    await result.current.handleUpdateUploadedWardrobeItem(
      {
        id: "uploaded-1",
        source: "uploaded",
      },
      {
        name: "Uploaded top",
        description: null,
        brand: null,
        audience: "all",
        category: "top",
        season: ["summer"],
        formality_level: [],
        style: [],
        occasions: [],
        color_base: [],
        pattern: null,
        finish: null,
        composition: null,
        silhouette: null,
        fit: null,
        closure_type: [],
      },
    );
    await result.current.handleSaveSettings({
      fullname: "Ada",
      locale: "en",
      theme: "system",
      llm: "none",
      image_llm: "openai:gpt-image-2",
    });
    await result.current.handleSearchCapsules("spring");
    await result.current.handleShareCapsule();
    result.current.handleToggleRegenerationSelection({
      url: "https://example.com/top",
    });
    await result.current.handleVerifyCode({ preventDefault: vi.fn() } as never);
    result.current.registerCapsuleSidebarActions({
      openSearchDialog: vi.fn(),
      openCapsuleActions: vi.fn(),
    });
    result.current.resetToEmail();
    await result.current.signOut();

    expect(navigateApp).toHaveBeenCalledWith("explore", { query: "linen" });
    expect(setCurrentView).toHaveBeenCalledWith("main");
    expect(setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(capsuleActions.openCapsule).toHaveBeenCalledWith(
      actionContext,
      "capsule-2",
    );
    expect(capsuleActions.importSharedCapsuleToApp).toHaveBeenCalledWith(
      actionContext,
      "share-meta",
    );
    expect(profileActions.deleteUserProfile).toHaveBeenCalledWith(
      actionContext,
      sessionActionContext,
    );
    expect(wardrobeActions.downloadWardrobePdf).toHaveBeenCalledWith(
      actionContext,
      "capsule-1",
    );
    expect(wardrobeActions.removeItemFromMyWardrobe).toHaveBeenCalledWith(
      actionContext,
      { url: "https://example.com/top" },
    );
    expect(wardrobeActions.saveItemToMyWardrobe).toHaveBeenCalledWith(
      actionContext,
      { url: "https://example.com/top" },
    );
    expect(wardrobeActions.updateUploadedItemInMyWardrobe).toHaveBeenCalledWith(
      actionContext,
      { id: "uploaded-1", source: "uploaded" },
      expect.objectContaining({ name: "Uploaded top" }),
    );
    expect(profileActions.saveSettings).toHaveBeenCalledWith(actionContext, {
      fullname: "Ada",
      locale: "en",
      theme: "system",
      llm: "none",
      image_llm: "openai:gpt-image-2",
    });
    expect(sessionActions.googleCredential).toHaveBeenCalledWith(
      sessionActionContext,
      "token",
    );
    expect(setIsSignOutConfirmOpen).toHaveBeenCalledWith(true);
    expect(capsuleSidebarActionsRef.current).toEqual(
      expect.objectContaining({
        openSearchDialog: expect.any(Function),
      }),
    );
  });
});
