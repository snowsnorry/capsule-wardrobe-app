import { beforeEach, describe, expect, test, vi } from "vitest";
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
  loadMoreRecentCapsules: vi.fn(),
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
const outfitActions = vi.hoisted(() => ({
  copyOutfitSetToOutfits: vi.fn(),
  deleteCurrentOutfit: vi.fn(),
  downloadCurrentOutfitPdf: vi.fn(),
  duplicateCurrentOutfit: vi.fn(),
  loadMoreRecentOutfits: vi.fn(),
  replaceCurrentOutfitItems: vi.fn(),
  renameCurrentOutfit: vi.fn(),
  revertCurrentOutfit: vi.fn(),
  saveCurrentOutfit: vi.fn(),
  searchUserOutfits: vi.fn(),
  selectUserOutfit: vi.fn(),
}));
const likedItemActions = vi.hoisted(() => ({
  setItemLike: vi.fn(),
}));
const sessionActions = vi.hoisted(() => ({
  googleCredential: vi.fn(),
  passkeySignIn: vi.fn(),
  requestCode: vi.fn(),
  resetToEmail: vi.fn(),
  signOut: vi.fn(),
  verifyCode: vi.fn(),
}));
const capsulesApi = vi.hoisted(() => ({
  selectCapsule: vi.fn(),
}));

vi.mock("./capsuleActions", () => capsuleActions);
vi.mock("../api/capsules", () => capsulesApi);
vi.mock("./profileActions", () => profileActions);
vi.mock("./wardrobeActions", () => wardrobeActions);
vi.mock("./sessionActions", () => sessionActions);
vi.mock("./outfitActions", () => outfitActions);
vi.mock("./likedItemActions", () => likedItemActions);

beforeEach(() => {
  vi.clearAllMocks();
});

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
    const navigateCapsule = vi.fn();
    const navigateOutfit = vi.fn();
    const navigateNewCapsule = vi.fn();
    const navigateNewOutfit = vi.fn();
    const setCurrentView = vi.fn();
    const setIsSignOutConfirmOpen = vi.fn();
    const setSelectedRegenerationUrls = vi.fn();
    const capsuleSidebarActionsRef = { current: null };
    const outfitSidebarActionsRef = { current: null };
    capsuleActions.duplicateCurrentCapsule.mockResolvedValue({
      id: "capsule-copy",
    });
    outfitActions.duplicateCurrentOutfit.mockResolvedValue({
      id: "outfit-copy",
    });
    outfitActions.copyOutfitSetToOutfits.mockResolvedValue({
      id: "outfit-from-capsule",
    });
    capsuleActions.searchUserCapsules.mockResolvedValue([{ id: "capsule-2" }]);
    outfitActions.searchUserOutfits.mockResolvedValue([{ id: "outfit-2" }]);
    capsuleActions.shareCurrentCapsule.mockResolvedValue({
      url: "https://share.example.test",
    });

    const { result } = renderHook(() =>
      useAppHandlers({
        activeCapsuleId: "capsule-1",
        activeOutfitId: "outfit-1",
        capsuleSidebarActionsRef,
        outfitSidebarActionsRef,
        getAppActionContext: () => actionContext,
        navigateCapsule,
        navigateOutfit,
        navigateApp,
        navigateNewCapsule,
        navigateNewOutfit,
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
    await result.current.handleCreateOutfitFromSidebar();
    await result.current.handleOpenCapsuleFromSidebar("capsule-2");
    await result.current.handleOpenOutfitFromSidebar("outfit-2");
    await result.current.handleSaveCapsule();
    await result.current.handleSaveOutfit();
    await result.current.handleRevertCapsule();
    await result.current.handleRevertOutfit();
    await result.current.handleRenameCapsule("Renamed");
    await result.current.handleRenameOutfit("Outfit renamed");
    await result.current.handleDuplicateCapsule("Copy");
    await result.current.handleDuplicateOutfit("Outfit copy");
    await result.current.handleCopyOutfitSetToOutfits("Capsule: Outfit 1", [
      { url: "https://example.com/top", source: "from_catalog" },
    ]);
    await result.current.handleDeleteCapsule();
    await result.current.handleDeleteOutfit();
    await result.current.handleImportSharedCapsule();
    await result.current.handleDeleteOutfitSetImage(1);
    await result.current.handleDeleteProfile();
    await result.current.handleDownloadWardrobePdf();
    await result.current.handleDownloadOutfitPdf();
    await result.current.handleGenerateOutfitSetImage(2);
    await result.current.handleGoogleCredential("token");
    await result.current.handlePasskeySignIn();
    await result.current.handleRefreshWardrobe();
    await result.current.handleReplaceOutfitItems("outfit-1", []);
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
    await result.current.handleSetItemLike(
      { url: "https://example.com/top" },
      true,
    );
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
        formalityLevel: [],
        style: [],
        occasions: [],
        colorBase: [],
        pattern: null,
        finish: null,
        composition: null,
        silhouette: null,
        fit: null,
        closureType: [],
      },
    );
    await result.current.handleSaveSettings({
      fullname: "Ada",
      locale: "en",
      theme: "system",
      llm: "none",
      imageLlm: "openai:gpt-image-2",
    });
    await result.current.handleLoadMoreCapsules();
    await result.current.handleLoadMoreOutfits();
    await result.current.handleSearchCapsules("spring");
    await result.current.handleSearchOutfits("weekend");
    await result.current.handleShareCapsule();
    result.current.handleToggleRegenerationSelection({
      url: "https://example.com/top",
    });
    await result.current.handleVerifyCode({ preventDefault: vi.fn() } as never);
    result.current.registerCapsuleSidebarActions({
      openSearchDialog: vi.fn(),
      openCapsuleActions: vi.fn(),
    });
    result.current.registerOutfitSidebarActions({
      openSearchDialog: vi.fn(),
      openOutfitActions: vi.fn(),
    });
    result.current.resetToEmail();
    await result.current.signOut();

    expect(navigateApp).toHaveBeenCalledWith("explore", { query: "linen" });
    expect(setCurrentView).toHaveBeenCalledWith("main");
    expect(setSelectedRegenerationUrls).toHaveBeenCalledWith([]);
    expect(navigateNewCapsule).toHaveBeenCalled();
    expect(navigateNewOutfit).toHaveBeenCalled();
    expect(capsulesApi.selectCapsule).toHaveBeenCalledWith("capsule-2");
    expect(navigateCapsule).toHaveBeenCalledWith("capsule-2");
    expect(outfitActions.selectUserOutfit).toHaveBeenCalledWith("outfit-2");
    expect(navigateOutfit).toHaveBeenCalledWith("outfit-2");
    expect(navigateOutfit).toHaveBeenCalledWith("outfit-copy", {
      replace: true,
    });
    expect(outfitActions.copyOutfitSetToOutfits).toHaveBeenCalledWith(
      actionContext,
      "Capsule: Outfit 1",
      [{ url: "https://example.com/top", source: "from_catalog" }],
    );
    expect(navigateOutfit).not.toHaveBeenCalledWith("outfit-from-capsule", {
      replace: true,
    });
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
    expect(outfitActions.downloadCurrentOutfitPdf).toHaveBeenCalledWith(
      actionContext,
      "outfit-1",
    );
    expect(outfitActions.replaceCurrentOutfitItems).toHaveBeenCalledWith(
      actionContext,
      "outfit-1",
      [],
    );
    expect(wardrobeActions.removeItemFromMyWardrobe).toHaveBeenCalledWith(
      actionContext,
      { url: "https://example.com/top" },
    );
    expect(wardrobeActions.saveItemToMyWardrobe).toHaveBeenCalledWith(
      actionContext,
      { url: "https://example.com/top" },
    );
    expect(likedItemActions.setItemLike).toHaveBeenCalledWith(
      actionContext,
      { url: "https://example.com/top" },
      true,
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
      imageLlm: "openai:gpt-image-2",
    });
    expect(capsuleActions.loadMoreRecentCapsules).toHaveBeenCalledWith(
      actionContext,
    );
    expect(outfitActions.loadMoreRecentOutfits).toHaveBeenCalledWith(
      actionContext,
    );
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
    expect(outfitSidebarActionsRef.current).toEqual(
      expect.objectContaining({
        openSearchDialog: expect.any(Function),
      }),
    );
  });

  test("closes the sidebar after validating capsule open", async () => {
    const actionContext = createActionContext();
    const sessionActionContext = createSessionContext();
    const calls: string[] = [];
    let resolveSelectCapsule: () => void = () => {};
    const navigateApp = vi.fn();
    const navigateCapsule = vi.fn(() => calls.push("navigate-capsule"));
    const navigateNewCapsule = vi.fn();
    const onComplete = vi.fn(() => calls.push("close-sidebar"));

    capsulesApi.selectCapsule.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          calls.push("select-start");
          resolveSelectCapsule = () => {
            calls.push("select-resolve");
            resolve();
          };
        }),
    );

    const { result } = renderHook(() =>
      useAppHandlers({
        activeCapsuleId: "capsule-1",
        capsuleSidebarActionsRef: { current: null },
        getAppActionContext: () => actionContext,
        navigateCapsule,
        navigateApp,
        navigateNewCapsule,
        pendingShareId: "",
        setCurrentView: vi.fn(),
        setIsSignOutConfirmOpen: vi.fn(),
        setSelectedRegenerationUrls: vi.fn(),
        shareMetadata: null,
        sessionActionContext,
      }),
    );

    const openPromise = result.current.handleOpenCapsuleFromSidebar(
      "capsule-2",
      onComplete,
    );

    expect(calls).toEqual(["select-start"]);
    expect(onComplete).not.toHaveBeenCalled();

    resolveSelectCapsule();
    await openPromise;

    expect(calls).toEqual([
      "select-start",
      "select-resolve",
      "navigate-capsule",
      "close-sidebar",
    ]);
    expect(navigateCapsule).toHaveBeenCalledWith("capsule-2");
  });
});
