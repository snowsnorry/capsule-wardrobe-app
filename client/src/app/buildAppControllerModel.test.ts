import { describe, expect, test, vi } from "vitest";
import { buildAppControllerModel } from "./buildAppControllerModel";
import { createActionContext, createTestCapsule } from "./testUtils";
import type { MouseEvent } from "react";

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
    "handleRemoveFromMyWardrobe",
    "handleSaveProfile",
    "handleSaveSettings",
    "handleSaveToMyWardrobe",
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
    const event = {
      currentTarget: document.createElement("button"),
    } as unknown as MouseEvent<HTMLElement>;
    const capsule = createTestCapsule({ id: "capsule-2" });

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

    model.onClearError();
    model.onCloseSignOutConfirm();
    model.onAddPasskey();
    model.onDismissPasskey();
    model.onImportSharedCapsule();
    model.onLogout();
    model.onRequestNotificationPermission();
    model.openCapsuleActions(event, capsule);
    model.openSearchDialog();

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
    expect(sidebarActions.openCapsuleActions).toHaveBeenCalledWith(
      event,
      capsule,
    );
    expect(sidebarActions.openSearchDialog).toHaveBeenCalledTimes(1);
    expect(model.activeCapsuleId).toBe("capsule-1");
    expect(model.shareMetadata).toEqual({ id: "share-1" });
    expect(model.notificationOpen).toBe(true);
  });
});
