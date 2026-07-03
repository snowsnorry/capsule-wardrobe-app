import { describe, expect, test, vi } from "vitest";
import { buildAppControllerModel } from "./buildAppControllerModel";
import { createActionContext, createTestCapsule } from "./testUtils";

function createHandlers() {
  const names = [
    "handleApplyCapsuleFilters",
    "handleBackToMain",
    "handleCancelRegenerationSelection",
    "handleCopyOutfitSetToOutfits",
    "handleCreateCapsule",
    "handleCreateCapsuleFromSidebar",
    "handleDeleteCapsule",
    "handleDeleteOutfitSetImage",
    "handleDownloadWardrobePdf",
    "handleDuplicateCapsule",
    "handleGenerateOutfitSetImage",
    "handleGoogleCredential",
    "handleImportSharedCapsule",
    "handleLoadMoreCapsules",
    "handleNavigateApp",
    "handleOpenCapsule",
    "handleOpenCapsuleFromSidebar",
    "handlePasskeySignIn",
    "handleRefreshWardrobe",
    "handleRegenerateSelectedItems",
    "handleRenameCapsule",
    "handleRequestCode",
    "handleRequestSignOut",
    "handleResetProfileFilters",
    "handleRevertCapsule",
    "handleSaveCapsule",
    "handleRemoveFromPersonalItems",
    "handleSaveProfile",
    "handleSaveSettings",
    "handleSaveToPersonalItems",
    "handleUpdateUploadedWardrobeItem",
    "handleSearchCapsules",
    "handleShareCapsule",
    "handleToggleRegenerationSelection",
    "handleVerifyCode",
    "registerCapsuleSidebarActions",
    "resetToEmail",
    "signOut",
  ];

  return Object.fromEntries(names.map((name) => [name, vi.fn()]));
}

describe("buildAppControllerModel", () => {
  test("wires controller callbacks to handlers, refs, and state setters", async () => {
    const sidebarActions = {
      openCapsuleActions: vi.fn(),
      openSearchDialog: vi.fn(),
    };
    const appState = {
      ...createActionContext(),
      activeCapsuleMeta: createTestCapsule(),
      capsuleList: [createTestCapsule()],
      capsulePagination: { limit: 10, offset: 0, total: 1, hasMore: false },
      capsuleSidebarActionsRef: { current: sidebarActions },
      code: "123456",
      currentView: "main",
      email: "person@example.com",
      hasProfile: true,
      isCheckingSession: false,
      isContentOperationLoading: false,
      isDownloadingWardrobePdf: false,
      isLoadingItems: false,
      isSignOutConfirmOpen: false,
      isWardrobePending: false,
      partialRegenerationPendingUrls: [],
      pendingImageSetIndexes: [],
      profileItems: [],
      profileCreated: true,
      profileOutfitSets: [],
      selectedColor: null,
      selectedPattern: "solid",
      selectedSourceMode: "catalog_only",
      selectedStyle: "minimalistic",
      selectedText: "",
      sessionInitialized: true,
      status: { loading: false, error: "", infoKey: "", infoParams: null },
      setCode: vi.fn(),
      setEmail: vi.fn(),
      setIsSignOutConfirmOpen: vi.fn(),
      setSelectedAudience: vi.fn(),
      setSelectedColor: vi.fn(),
      setSelectedFormalityLevel: vi.fn(),
      setSelectedOccasions: vi.fn(),
      setSelectedPattern: vi.fn(),
      setSelectedSeason: vi.fn(),
      setSelectedSourceMode: vi.fn(),
      setSelectedStyle: vi.fn(),
      setSelectedText: vi.fn(),
      step: "email",
    };
    const handlers = createHandlers();
    const setStatus = vi.fn();
    const dismissPasskeyPrompt = vi.fn();
    const handleAddPasskeyFromPrompt = vi.fn();
    const requestBrowserNotificationPermission = vi.fn();
    const setIsSignOutConfirmOpen = vi.fn();
    const clearShareRoute = vi.fn();
    const model = buildAppControllerModel({
      appState,
      appTheme: { palette: {} },
      cardPadding: 5,
      clearShareRoute,
      dismissPasskeyPrompt,
      handleAddPasskeyFromPrompt,
      handlers,
      isLarge: true,
      isShareDialogOpen: false,
      isShareLoading: false,
      jobTracker: {
        activeJobEntityKeys: ["capsule:capsule-1"],
        jobs: [],
        waitForJobCompletion: vi.fn(),
      },
      navigation: {
        appRoute: "capsule",
        capsuleRouteId: "",
        capsuleRouteMode: "empty",
        searchAutoOpenProductDetail: null,
        searchInitialQuery: "",
      },
      notifications: {
        notificationPrompt: { open: true },
        requestBrowserNotificationPermission,
      },
      passkeyPrompt: { open: true },
      profileOptions: {
        audienceOptions: ["woman"],
        occasionOptions: ["office"],
        orderedSeasonOptions: ["summer"],
        patternOptions: ["solid"],
        styleOptions: { core: ["casual"], aesthetics: ["minimalistic"] },
      },
      requestBrowserNotificationPermission,
      setIsSignOutConfirmOpen,
      setStatus,
      shareMetadata: { id: "share-1" },
      t: (key: string) => key,
      toggleSelection: vi.fn(),
      viewState: {
        hasBrandedPanelHeader: false,
        hasFilterChanges: true,
        isContentBusy: false,
        isMainScreenView: true,
        isWardrobeView: false,
        isSearchView: false,
        isSignInView: false,
        isStatisticsView: false,
      },
    } as never);

    model.snackbars.onClearError();
    model.dialogs.onCloseSignOutConfirm();
    model.snackbars.onAddPasskey();
    model.snackbars.onDismissPasskey();
    model.dialogs.onImportSharedCapsule();
    model.dialogs.onLogout();
    model.snackbars.onRequestNotificationPermission();
    model.shell.openSearchDialog();

    expect(setStatus).toHaveBeenCalledWith(expect.any(Function));
    expect(
      setStatus.mock.calls[0][0]({ loading: false, error: "old" }),
    ).toEqual({ loading: false, error: "" });
    expect(setIsSignOutConfirmOpen).toHaveBeenCalledWith(false);
    expect(handleAddPasskeyFromPrompt).toHaveBeenCalledTimes(1);
    expect(dismissPasskeyPrompt).toHaveBeenCalledTimes(1);
    expect(handlers.handleImportSharedCapsule).toHaveBeenCalledTimes(1);
    expect(handlers.signOut).toHaveBeenCalledTimes(1);
    expect(requestBrowserNotificationPermission).toHaveBeenCalledTimes(1);
    expect(sidebarActions.openSearchDialog).toHaveBeenCalledTimes(1);
    expect(model.shell.activeCapsuleId).toBe("capsule-1");
    expect(model.route.activeJobEntityKeys).toEqual(["capsule:capsule-1"]);
    expect(model.dialogs.shareMetadata).toEqual({ id: "share-1" });
    expect(model.snackbars.notificationOpen).toBe(true);
    expect(model.route.profileItems).toBe(appState.profileItems);
    expect(model.shell).not.toHaveProperty("profileItems");
    expect(model.route).not.toHaveProperty("isShareDialogOpen");
    expect(model.dialogs).not.toHaveProperty("profileItems");
  });
});
