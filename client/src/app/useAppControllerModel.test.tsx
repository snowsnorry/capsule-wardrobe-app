import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppControllerModel } from "./useAppControllerModel";
import { createActionContext, createTestProfile } from "./testUtils";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const controllerOperations = vi.hoisted(() => ({
  applyCapsuleState: vi.fn(),
  applyWardrobeSnapshot: vi.fn(),
  bootstrapCapsules: vi.fn(),
  buildCurrentDraftSnapshot: vi.fn(),
  getAppActionContext: vi.fn(),
  startCapsuleEventStream: vi.fn(),
  startPendingNotificationFlow: vi.fn(),
}));

vi.mock("@mui/material", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@mui/material")>()),
  useMediaQuery: mediaQueryMock,
}));

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  }),
}));

vi.mock("../theme", () => ({
  createAppTheme: (mode: string) => ({ mode }),
}));

vi.mock("./appViewState", () => ({
  buildAppViewState: () => ({
    hasBrandedPanelHeader: false,
    hasFilterChanges: false,
    isContentBusy: false,
    isMainScreenView: true,
    isMyWardrobeView: false,
    isSearchView: false,
    isSignInView: false,
    isStatisticsView: false,
  }),
  resolveThemeMode: (_theme: string, prefersDarkMode: boolean) =>
    prefersDarkMode ? "dark" : "light",
  toggleStringSelection: vi.fn(),
}));

vi.mock("./buildAppActionContext", () => ({
  buildAppActionContext: vi.fn(() => ({})),
}));

vi.mock("./buildAppControllerModel", () => ({
  buildAppControllerModel: vi.fn((input) => input),
}));

vi.mock("./buildAppSessionActionContext", () => ({
  buildAppSessionActionContext: () => ({ sessionActionContext: {} }),
}));

vi.mock("./errorMessages", () => ({
  resolveAppErrorMessage: (error: { message?: string } | null | undefined) =>
    error?.message || "resolved",
}));

vi.mock("./useAppControllerOperations", () => ({
  useAppControllerOperations: () => controllerOperations,
}));

vi.mock("./useAppHandlers", () => ({
  useAppHandlers: () => ({ signOut: vi.fn() }),
}));

vi.mock("./useAppLifecycleEffects", () => ({
  useAppLifecycleEffects: vi.fn(),
}));

vi.mock("./useAppNavigation", () => ({
  useAppNavigation: () => ({
    appRoute: "main",
    clearShareRoute: vi.fn(),
    navigateApp: vi.fn(),
    pendingShareId: "",
    resetNavigation: vi.fn(),
    searchAutoOpenProductDetail: null,
    searchInitialQuery: "",
  }),
}));

vi.mock("./useAppNotifications", () => ({
  useAppNotifications: () => ({
    closeNotificationPrompt: vi.fn(),
    notificationPrompt: { open: false },
    requestBrowserNotificationPermission: vi.fn(),
  }),
}));

vi.mock("./useAppState", () => ({
  useAppState: () => ({
    ...createActionContext(),
    activeCapsuleMeta: null,
    capsuleList: [],
    capsuleSidebarActionsRef: { current: null },
    code: "",
    currentView: "main",
    email: "",
    hasProfile: true,
    isCheckingSession: false,
    isContentOperationLoading: false,
    isDownloadingWardrobePdf: false,
    isSignOutConfirmOpen: false,
    isWardrobePending: false,
    partialRegenerationPendingUrls: [],
    pendingImageSetIndexes: [],
    profileCreated: true,
    profileOutfitSets: [],
    selectedColor: null,
    selectedPattern: "solid",
    selectedStyle: "casual",
    selectedText: "",
    sessionInitialized: true,
    setCode: vi.fn(),
    setEmail: vi.fn(),
    setIsSignOutConfirmOpen: vi.fn(),
    setSessionInitialized: vi.fn(),
    setSelectedAudience: vi.fn(),
    setSelectedColor: vi.fn(),
    setSelectedFormalityLevel: vi.fn(),
    setSelectedOccasions: vi.fn(),
    setSelectedPattern: vi.fn(),
    setSelectedSeason: vi.fn(),
    setSelectedStyle: vi.fn(),
    setSelectedText: vi.fn(),
    setUser: vi.fn(),
    settingsProfile: createTestProfile({ theme: "system" }),
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    step: "email",
  }),
}));

vi.mock("./usePasskeyPrompt", () => ({
  usePasskeyPrompt: () => ({
    dismissPasskeyPrompt: vi.fn(),
    handleAddPasskeyFromPrompt: vi.fn(),
    maybeShowPasskeyPrompt: vi.fn(),
    passkeyPrompt: { open: false },
  }),
}));

vi.mock("./useProfileOptions", () => ({
  useProfileOptions: () => ({
    applyWardrobeFilters: vi.fn(),
    audienceOptions: [],
    ensureOptionsLoaded: vi.fn(),
    occasionOptions: [],
    orderedSeasonOptions: [],
    patternOptions: [],
    preloadOnboardingOptions: vi.fn(),
    styleOptions: { core: [], aesthetics: [] },
  }),
}));

vi.mock("./useSessionBootstrap", () => ({
  useSessionBootstrap: vi.fn(),
}));

vi.mock("./useShareRoute", () => ({
  useShareRoute: () => ({
    clearShareRoute: vi.fn(),
    isShareDialogOpen: false,
    isShareLoading: false,
    setIsShareLoading: vi.fn(),
    shareMetadata: null,
  }),
}));

function HookHarness() {
  const model = useAppControllerModel() as unknown as {
    cardPadding: number;
    appTheme: { mode: string };
  };
  return (
    <div>
      <span data-testid="padding">{model.cardPadding}</span>
      <span data-testid="theme">{model.appTheme.mode}</span>
    </div>
  );
}

describe("useAppControllerModel", () => {
  test("uses large-screen padding and dark system theme when media queries match", () => {
    mediaQueryMock.mockImplementation(
      (query: string) =>
        query.includes("min-width") || query.includes("prefers-color-scheme"),
    );

    render(<HookHarness />);

    expect(screen.getByTestId("padding")).toHaveTextContent("5");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });
});
