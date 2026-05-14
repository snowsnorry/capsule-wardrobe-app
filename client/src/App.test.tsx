import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import App from "./App";
import { LocaleProvider } from "./i18n/LocaleProvider";

const authApi = vi.hoisted(() => ({
  clearRequestCache: vi.fn(),
  deleteProfile: vi.fn(),
  fetchCurrentUser: vi.fn(),
  initializeProfile: vi.fn(),
  logout: vi.fn(),
  requestLoginCode: vi.fn(),
  signInWithGoogle: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileLocale: vi.fn(),
  verifyLoginCode: vi.fn(),
}));

const capsulesApi = vi.hoisted(() => ({
  createCapsule: vi.fn(),
  deleteCapsule: vi.fn(),
  downloadCapsulePdf: vi.fn(),
  duplicateCapsule: vi.fn(),
  fetchCapsule: vi.fn(),
  fetchCapsuleBootstrap: vi.fn(),
  fetchRecentCapsules: vi.fn(),
  fetchSharedCapsule: vi.fn(),
  importSharedCapsule: vi.fn(),
  renameCapsule: vi.fn(),
  revertCapsule: vi.fn(),
  saveCapsule: vi.fn(),
  searchCapsules: vi.fn(),
  shareCapsule: vi.fn(),
  updateCapsuleFilters: vi.fn(),
}));

const profileOptionsApi = vi.hoisted(() => ({
  clearProfileOptionsCache: vi.fn(),
  loadProfileOptions: vi.fn(),
  primeProfileOptionsCache: vi.fn((filters) => ({
    styles: {
      core: filters.formalityLevels || [],
      aesthetics: filters.styles || [],
    },
    occasions: filters.occasions || [],
    seasons: filters.seasons || [],
    audience: filters.audience || [],
    patterns: filters.patterns || [],
  })),
}));

const wardrobeApi = vi.hoisted(() => ({
  deleteOutfitSetImage: vi.fn(),
  generateOutfitSetImage: vi.fn(),
  regenerateCapsuleWardrobe: vi.fn(),
  regenerateSelectedWardrobeItems: vi.fn(),
  subscribeCapsuleEvents: vi.fn(),
}));

vi.mock("./api/auth", () => authApi);
vi.mock("./api/capsules", () => capsulesApi);
vi.mock("./api/profileOptionsCache", () => profileOptionsApi);
vi.mock("./api/wardrobe", () => wardrobeApi);

vi.mock("./screens/LoadingScreen", () => ({
  default: () => <div data-testid="loading-screen">loading-screen</div>,
}));

vi.mock("./screens/SignInScreen", () => ({
  default: function SignInScreenMock(props: {
    onVerifyCode: (event: { preventDefault: () => void }) => Promise<void>;
  }) {
    return (
      <div data-testid="sign-in-screen">
        <div data-testid="locale-switcher">locale-switcher</div>
        <button
          type="button"
          onClick={() => void props.onVerifyCode({ preventDefault: vi.fn() })}
        >
          verify-code
        </button>
      </div>
    );
  },
}));

vi.mock("./screens/OnboardingScreen", () => ({
  default: () => <div data-testid="onboarding-screen">onboarding-screen</div>,
}));

vi.mock("./screens/mainScreen/MainScreen", () => ({
  default: function MainScreenMock(props: {
    onNavigateApp: (
      route: "capsule" | "explore" | "myWardrobe" | "statistics",
    ) => void;
  }) {
    return (
      <div data-testid="main-screen">
        <button type="button" onClick={() => props.onNavigateApp("explore")}>
          open-explore
        </button>
        <button type="button" onClick={() => props.onNavigateApp("statistics")}>
          open-statistics
        </button>
      </div>
    );
  },
}));

vi.mock("./screens/SearchScreen", () => ({
  default: function SearchScreenMock() {
    const backToCapsule = () => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
    };

    return (
      <div data-testid="search-screen">
        <button type="button" onClick={backToCapsule}>
          back-to-capsule
        </button>
      </div>
    );
  },
}));

vi.mock("./screens/StatisticsScreen", () => ({
  default: () => <div data-testid="statistics-screen">statistics-screen</div>,
}));

vi.mock("./screens/ProfileScreen", () => ({
  default: () => <div data-testid="profile-screen">profile-screen</div>,
}));

function renderApp() {
  return render(
    <LocaleProvider>
      <App />
    </LocaleProvider>,
  );
}

function createBootstrapResponse({
  activeSnapshot,
  locale = "en",
}: {
  activeSnapshot?: {
    status?: string;
    items?: { id?: string; url?: string; category?: string }[];
  };
  locale?: string;
} = {}) {
  const activeCapsule = {
    id: "capsule-1",
    name: "Spring edit",
    draft: {
      filters: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["spring"],
        audience: "woman",
        color: null,
        pattern: "solid",
        text: "",
      },
      data: {
        wardrobe: { items: [] },
        rejectedUrls: [],
      },
    },
    saved: null,
    status: "new",
  };

  return {
    hasProfile: true,
    profile: {
      email: "person@example.com",
      locale,
      theme: "system",
      llm: "none",
      image_llm: "openai:gpt-image-2",
      fullname: "",
    },
    activeCapsule,
    activeSnapshot,
    capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    wardrobeFilters: {
      formalityLevels: ["casual", "smart_casual", "formal"],
      styles: ["minimalistic"],
      occasions: ["office"],
      seasons: ["spring", "summer"],
      audience: ["woman", "man", "any"],
      patterns: ["solid"],
    },
  };
}

function mockProfileOptions() {
  profileOptionsApi.loadProfileOptions.mockResolvedValue({
    styles: {
      core: ["casual", "smart_casual", "formal"],
      aesthetics: ["minimalistic"],
    },
    occasions: ["office"],
    seasons: ["spring", "summer"],
    audience: ["woman", "man", "any"],
    patterns: ["solid"],
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    mockProfileOptions();
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(
      createBootstrapResponse(),
    );
    capsulesApi.fetchRecentCapsules.mockResolvedValue({
      capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }],
    });
    capsulesApi.fetchCapsule.mockResolvedValue({
      capsule: createBootstrapResponse().activeCapsule,
    });
    authApi.updateProfileLocale.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  test("shows sign-in screen when session bootstrap fails", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));

    renderApp();

    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(capsulesApi.fetchCapsuleBootstrap).not.toHaveBeenCalled();
  });

  test("bootstraps an existing profile and switches between app routes", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({
      user: { email: "person@example.com" },
    });

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(capsulesApi.fetchCapsuleBootstrap).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "open-explore" }));
    expect(await screen.findByTestId("search-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "back-to-capsule" }));
    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "open-statistics" }));
    expect(await screen.findByTestId("statistics-screen")).toBeInTheDocument();
  });

  test("uses bootstrap capsule data without fetching active capsule or recent capsules", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(
      createBootstrapResponse({
        activeSnapshot: {
          status: "ready",
          items: [
            {
              id: "top-1",
              url: "https://example.com/top-1",
              category: "top",
            },
          ],
        },
      }),
    );

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(capsulesApi.fetchCapsuleBootstrap).toHaveBeenCalledTimes(1);
    });
    expect(capsulesApi.fetchCapsule).not.toHaveBeenCalled();
    expect(capsulesApi.fetchRecentCapsules).not.toHaveBeenCalled();
    expect(profileOptionsApi.loadProfileOptions).not.toHaveBeenCalled();
  });

  test("opens statistics on direct statistics route after session bootstrap", async () => {
    window.history.replaceState({}, "", "/statistics");
    authApi.fetchCurrentUser.mockResolvedValue({
      user: { email: "person@example.com" },
    });

    renderApp();

    expect(await screen.findByTestId("statistics-screen")).toBeInTheDocument();
  });

  test("does not patch profile locale during bootstrap when the persisted locale already came from the server", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(
      createBootstrapResponse({ locale: "ru" }),
    );

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    expect(authApi.updateProfileLocale).not.toHaveBeenCalled();
  });

  test("retries capsule bootstrap after verifying a code", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));
    authApi.verifyLoginCode.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    capsulesApi.fetchCapsuleBootstrap
      .mockRejectedValueOnce(new Error("temporary"))
      .mockRejectedValueOnce(new Error("temporary"))
      .mockResolvedValue(createBootstrapResponse());

    renderApp();

    fireEvent.click(await screen.findByRole("button", { name: "verify-code" }));

    await waitFor(() => {
      expect(screen.getByTestId("main-screen")).toBeInTheDocument();
    });
    expect(capsulesApi.fetchCapsuleBootstrap).toHaveBeenCalledTimes(3);
  });
});
