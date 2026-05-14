import { Suspense } from "react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../screens/mainScreen/MainScreen", () => ({
  default: ({
    onToggleOccasion,
    onToggleSeason,
    onOpenCapsule,
    items,
    userEmail,
  }) => (
    <div>
      <span>
        main:{userEmail}:{items.length}
      </span>
      <button type="button" onClick={() => onToggleOccasion("office")}>
        main-occasion
      </button>
      <button type="button" onClick={() => onToggleSeason("summer")}>
        main-season
      </button>
      <button type="button" onClick={() => onOpenCapsule("capsule-1")}>
        open-capsule
      </button>
    </div>
  ),
}));

vi.mock("../screens/ProfileScreen", () => ({
  default: ({ onToggleOccasion, onToggleSeason, onBack }) => (
    <div>
      <button type="button" onClick={() => onToggleOccasion("office")}>
        profile-occasion
      </button>
      <button type="button" onClick={() => onToggleSeason("summer")}>
        profile-season
      </button>
      <button type="button" onClick={onBack}>
        profile-back
      </button>
    </div>
  ),
}));

vi.mock("../screens/OnboardingScreen", () => ({
  default: ({ onToggleOccasion, onToggleSeason, onNext }) => (
    <div>
      <button type="button" onClick={() => onToggleOccasion("office")}>
        onboarding-occasion
      </button>
      <button type="button" onClick={() => onToggleSeason("summer")}>
        onboarding-season
      </button>
      <button type="button" onClick={onNext}>
        onboarding-next
      </button>
    </div>
  ),
}));

vi.mock("../screens/SearchScreen", () => ({
  default: ({ initialQuery, autoOpenProductDetail }) => (
    <div>
      search:{initialQuery}:{String(autoOpenProductDetail)}
    </div>
  ),
}));

vi.mock("../screens/MyWardrobeScreen", () => ({
  default: () => <div>my wardrobe</div>,
}));

vi.mock("../screens/StatisticsScreen", () => ({
  default: () => <div>statistics</div>,
}));

vi.mock("../screens/SignInScreen", () => ({
  default: ({ email, onEmailChange }) => (
    <button type="button" onClick={() => onEmailChange("next@example.com")}>
      sign-in:{email}
    </button>
  ),
}));

import AppRouteContent from "./AppRouteContent";

type AppRouteContentProps = ComponentProps<typeof AppRouteContent>;

function makeProps(overrides: Record<string, unknown> = {}) {
  return {
    appRoute: "capsule",
    currentView: "main",
    hasFilterChanges: false,
    hasPendingAdditionalItems: false,
    hasProfile: true,
    isCheckingSession: false,
    isContentBusy: false,
    isDownloadingWardrobePdf: false,
    isLoadingItems: false,
    isPartialRegenerationLoading: false,
    isSigningOut: false,
    onboardingStep: 1,
    partialRegenerationPendingUrls: [],
    pendingImageSetIndexes: [],
    profileCreated: false,
    profileItems: null,
    profileOutfitSets: [],
    searchAutoOpenProductDetail: false,
    searchInitialQuery: "",
    selectedRegenerationUrls: [],
    sessionInitialized: true,
    settingsProfile: {
      fullname: "Person",
      email: "person@example.com",
      locale: "en",
      theme: "system",
      llm: "openai:gpt-5.5",
      imageLlm: "openai:gpt-image-2",
    },
    status: { loading: false, error: "", infoKey: "", infoParams: null },
    styleOptions: { core: ["casual"], aesthetics: ["minimal"] },
    t: (key: string) => key,
    occasionOptions: ["office"],
    orderedSeasonOptions: ["summer"],
    audienceOptions: ["woman"],
    patternOptions: ["solid"],
    selectedFormalityLevel: "casual",
    selectedStyle: null,
    selectedOccasions: [],
    selectedSeason: [],
    selectedAudience: "woman",
    selectedColor: null,
    selectedPattern: "solid",
    selectedText: "",
    user: { email: "person@example.com" },
    step: "email",
    email: "person@example.com",
    code: "",
    activeCapsuleMeta: { id: "capsule-1", name: "Spring", status: "new" },
    capsuleList: [{ id: "capsule-1", name: "Spring", status: "new" }],
    onApplyCapsuleFilters: vi.fn(() => Promise.resolve()),
    onBackToMain: vi.fn(),
    onBackOnboarding: vi.fn(),
    onCancelRegenerationSelection: vi.fn(),
    onCreateCapsule: vi.fn(() => Promise.resolve()),
    onDeleteCapsule: vi.fn(() => Promise.resolve()),
    onDeleteOutfitSetImage: vi.fn(() => Promise.resolve()),
    onDeleteProfile: vi.fn(() => Promise.resolve()),
    onDownloadWardrobePdf: vi.fn(() => Promise.resolve()),
    onDuplicateCapsule: vi.fn(() => Promise.resolve()),
    onFinishOnboarding: vi.fn(() => Promise.resolve()),
    onGenerateOutfitSetImage: vi.fn(() => Promise.resolve()),
    onGoogleCredential: vi.fn(() => Promise.resolve()),
    onNavigateApp: vi.fn(),
    onNextOnboarding: vi.fn(),
    onOpenCapsule: vi.fn(() => Promise.resolve()),
    onPasskeySignIn: vi.fn(() => Promise.resolve()),
    onRefreshWardrobe: vi.fn(() => Promise.resolve()),
    onRegenerateSelectedItems: vi.fn(() => Promise.resolve()),
    onRenameCapsule: vi.fn(() => Promise.resolve()),
    onRequestCode: vi.fn(() => Promise.resolve()),
    onRequestSignOut: vi.fn(),
    onResetEmail: vi.fn(),
    onResetProfileFilters: vi.fn(() => Promise.resolve()),
    onRevertCapsule: vi.fn(() => Promise.resolve()),
    onSaveCapsule: vi.fn(() => Promise.resolve()),
    onRemoveFromMyWardrobe: vi.fn(() => Promise.resolve()),
    onSaveToMyWardrobe: vi.fn(() => Promise.resolve()),
    onSaveProfile: vi.fn(() => Promise.resolve()),
    onSaveSettings: vi.fn(() => Promise.resolve()),
    onSearchCapsules: vi.fn(() => Promise.resolve([])),
    onShareCapsule: vi.fn(() => Promise.resolve({})),
    onToggleRegenerationSelection: vi.fn(),
    onVerifyCode: vi.fn(() => Promise.resolve()),
    registerCapsuleSidebarActions: vi.fn(),
    setCode: vi.fn(),
    setEmail: vi.fn(),
    setSelectedFormalityLevel: vi.fn(),
    setSelectedStyle: vi.fn(),
    setSelectedOccasions: vi.fn(),
    setSelectedSeason: vi.fn(),
    setSelectedAudience: vi.fn(),
    setSelectedColor: vi.fn(),
    setSelectedPattern: vi.fn(),
    setSelectedText: vi.fn(),
    toggleSelection: vi.fn(),
    ...overrides,
  };
}

function routeProps(overrides: Record<string, unknown> = {}) {
  return makeProps(overrides) as unknown as AppRouteContentProps;
}

function renderRoute(props: Record<string, unknown>) {
  return render(
    <Suspense fallback={<div>loading</div>}>
      <AppRouteContent {...routeProps(props)} />
    </Suspense>,
  );
}

describe("AppRouteContent", () => {
  afterEach(() => {
    cleanup();
  });

  test("renders nothing while session bootstrap is pending", () => {
    const { container } = renderRoute({ sessionInitialized: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("renders sign-in route for anonymous users", async () => {
    const user = userEvent.setup();
    const setEmail = vi.fn();
    renderRoute({ user: null, setEmail });

    await user.click(
      await screen.findByRole("button", { name: "sign-in:person@example.com" }),
    );

    expect(setEmail).toHaveBeenCalledWith("next@example.com");
  });

  test("renders my wardrobe, search, and statistics app routes", async () => {
    const { rerender } = renderRoute({
      appRoute: "explore",
      searchInitialQuery: "linen",
      searchAutoOpenProductDetail: true,
    });

    expect(await screen.findByText("search:linen:true")).toBeInTheDocument();

    rerender(
      <Suspense fallback={<div>loading</div>}>
        <AppRouteContent {...routeProps({ appRoute: "myWardrobe" })} />
      </Suspense>,
    );
    expect(await screen.findByText("my wardrobe")).toBeInTheDocument();

    rerender(
      <Suspense fallback={<div>loading</div>}>
        <AppRouteContent {...routeProps({ appRoute: "statistics" })} />
      </Suspense>,
    );
    expect(await screen.findByText("statistics")).toBeInTheDocument();
  });

  test("wires main route shared filter callbacks", async () => {
    const user = userEvent.setup();
    const props = routeProps();
    render(
      <Suspense fallback={<div>loading</div>}>
        <AppRouteContent {...props} />
      </Suspense>,
    );

    await user.click(
      await screen.findByRole("button", { name: "main-occasion" }),
    );
    await user.click(screen.getByRole("button", { name: "main-season" }));
    await user.click(screen.getByRole("button", { name: "open-capsule" }));

    expect(props.toggleSelection).toHaveBeenCalledWith(
      "office",
      [],
      props.setSelectedOccasions,
    );
    expect(props.toggleSelection).toHaveBeenCalledWith(
      "summer",
      [],
      props.setSelectedSeason,
    );
    expect(props.onOpenCapsule).toHaveBeenCalledWith("capsule-1");
  });

  test("wires profile and onboarding route shared filter callbacks", async () => {
    const user = userEvent.setup();
    const profileProps = routeProps({ currentView: "profile" });
    const { rerender } = render(
      <Suspense fallback={<div>loading</div>}>
        <AppRouteContent {...profileProps} />
      </Suspense>,
    );

    await user.click(
      await screen.findByRole("button", { name: "profile-occasion" }),
    );
    await user.click(screen.getByRole("button", { name: "profile-season" }));
    expect(profileProps.toggleSelection).toHaveBeenCalledWith(
      "office",
      [],
      profileProps.setSelectedOccasions,
    );
    expect(profileProps.toggleSelection).toHaveBeenCalledWith(
      "summer",
      [],
      profileProps.setSelectedSeason,
    );

    const onboardingProps = routeProps({
      hasProfile: false,
      profileCreated: false,
    });
    rerender(
      <Suspense fallback={<div>loading</div>}>
        <AppRouteContent {...onboardingProps} />
      </Suspense>,
    );
    await user.click(
      await screen.findByRole("button", { name: "onboarding-occasion" }),
    );
    await user.click(screen.getByRole("button", { name: "onboarding-season" }));
    expect(onboardingProps.toggleSelection).toHaveBeenCalledWith(
      "office",
      [],
      onboardingProps.setSelectedOccasions,
    );
    expect(onboardingProps.toggleSelection).toHaveBeenCalledWith(
      "summer",
      [],
      onboardingProps.setSelectedSeason,
    );
  });
});
