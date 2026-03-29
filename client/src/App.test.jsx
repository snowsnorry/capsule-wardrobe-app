import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App.jsx";
import { LocaleProvider } from "./i18n/LocaleProvider.jsx";

const authApi = vi.hoisted(() => ({
  fetchCurrentUser: vi.fn(),
  fetchProfile: vi.fn(),
  fetchProfileStatus: vi.fn(),
  updateProfile: vi.fn(),
  updateProfileLocale: vi.fn(),
  deleteProfile: vi.fn(),
  initializeProfile: vi.fn(),
  logout: vi.fn(),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn(),
  signInWithGoogle: vi.fn(),
  clearRequestCache: vi.fn()
}));

const profileOptionsApi = vi.hoisted(() => ({
  clearProfileOptionsCache: vi.fn(),
  loadProfileOptions: vi.fn()
}));

const wardrobeApi = vi.hoisted(() => ({
  fetchWardrobeItems: vi.fn(),
  downloadWardrobePdf: vi.fn(),
  regenerateSelectedWardrobeItems: vi.fn()
}));

vi.mock("./api/auth.js", () => authApi);
vi.mock("./api/profileOptionsCache.js", () => profileOptionsApi);
vi.mock("./api/wardrobe.js", () => wardrobeApi);

vi.mock("./screens/LoadingScreen.jsx", () => ({
  default: () => <div data-testid="loading-screen">loading-screen</div>
}));

vi.mock("./screens/SignInScreen.jsx", () => ({
  default: function SignInScreenMock(props) {
    return (
      <div data-testid="sign-in-screen">
        <div>sign-in-screen:{props.step}</div>
        <button
          type="button"
          onClick={() => {
            props.onEmailChange("person@example.com");
            queueMicrotask(() => {
              props.onRequestCode({ preventDefault() {} });
            });
          }}
        >
          request-code
        </button>
        <button
          type="button"
          onClick={() => {
            props.onEmailChange("person@example.com");
            props.onCodeChange("654321");
            queueMicrotask(() => {
              props.onVerifyCode({ preventDefault() {} });
            });
          }}
        >
          verify-code
        </button>
      </div>
    );
  }
}));

vi.mock("./screens/OnboardingScreen.jsx", () => ({
  default: function OnboardingScreenMock(props) {
    return (
      <div data-testid="onboarding-screen">
        <div>onboarding-step:{props.onboardingStep}</div>
        <button
          type="button"
          onClick={() => {
            props.onSelectStyleCore("casual");
            props.onToggleOccasion("office");
            props.onToggleSeason("summer");
            props.onSelectAudience("woman");
            props.onFinish();
          }}
        >
          finish-onboarding
        </button>
      </div>
    );
  }
}));

vi.mock("./screens/MainScreen.jsx", () => ({
  default: function MainScreenMock(props) {
    return (
      <div data-testid="main-screen">
        <div>main-screen:{props.items.length}</div>
        <button type="button" onClick={() => props.onNavigateApp("search")}>
          open-search
        </button>
        <button type="button" onClick={props.onSignOut}>
          sign-out
        </button>
      </div>
    );
  }
}));

vi.mock("./screens/ProfileScreen.jsx", () => ({
  default: () => <div data-testid="profile-screen">profile-screen</div>
}));

vi.mock("./screens/SearchScreen.jsx", () => ({
  default: function SearchScreenMock(props) {
    return (
      <div data-testid="search-screen">
        <button type="button" onClick={() => props.onNavigateApp("capsule")}>
          back-to-capsule
        </button>
      </div>
    );
  }
}));

function renderApp() {
  return render(
    <LocaleProvider>
      <App />
    </LocaleProvider>
  );
}

function mockProfileOptions() {
  profileOptionsApi.loadProfileOptions.mockResolvedValue({
    styles: {
      core: ["casual", "smart_casual", "formal"],
      aesthetics: ["minimalistic"]
    },
    occasions: ["office"],
    seasons: ["spring", "summer"],
    audience: ["woman", "man", "any"],
    patterns: ["solid"]
  });
}

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");

    authApi.fetchCurrentUser.mockReset();
    authApi.fetchProfile.mockReset();
    authApi.fetchProfileStatus.mockReset();
    authApi.updateProfile.mockReset();
    authApi.updateProfileLocale.mockReset();
    authApi.deleteProfile.mockReset();
    authApi.initializeProfile.mockReset();
    authApi.logout.mockReset();
    authApi.requestLoginCode.mockReset();
    authApi.verifyLoginCode.mockReset();
    authApi.signInWithGoogle.mockReset();
    authApi.clearRequestCache.mockReset();

    profileOptionsApi.clearProfileOptionsCache.mockReset();
    profileOptionsApi.loadProfileOptions.mockReset();

    wardrobeApi.fetchWardrobeItems.mockReset();
    wardrobeApi.downloadWardrobePdf.mockReset();
    wardrobeApi.regenerateSelectedWardrobeItems.mockReset();

    wardrobeApi.fetchWardrobeItems.mockResolvedValue({ items: [], status: "ready" });
  });

  afterEach(() => {
    cleanup();
  });

  test("shows sign-in screen when session bootstrap fails", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));

    renderApp();

    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();
    expect(authApi.fetchProfileStatus).not.toHaveBeenCalled();
  });

  test("transitions from sign-in to onboarding for users without a profile", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: false });
    mockProfileOptions();

    renderApp();

    await screen.findByTestId("sign-in-screen");
    fireEvent.click(screen.getByRole("button", { name: "request-code" }));
    await waitFor(() => {
      expect(authApi.requestLoginCode).toHaveBeenCalledWith(expect.any(String), "en");
    });

    fireEvent.click(screen.getByRole("button", { name: "verify-code" }));

    expect(await screen.findByTestId("onboarding-screen")).toBeInTheDocument();
    expect(authApi.verifyLoginCode).toHaveBeenCalledWith("person@example.com", expect.any(String));
    expect(profileOptionsApi.loadProfileOptions).toHaveBeenCalled();
  });

  test("bootstraps an existing profile, syncs locale, and switches between capsule and search routes", async () => {
    window.history.replaceState({}, "", "/search");
    authApi.fetchCurrentUser.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    authApi.fetchProfile.mockResolvedValue({
      profile: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["summer"],
        audience: "woman",
        color: "navy",
        pattern: "solid",
        locale: "ru"
      }
    });
    authApi.updateProfileLocale.mockResolvedValue({});
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("search-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(authApi.updateProfileLocale).toHaveBeenCalledWith("ru");
    });

    fireEvent.click(screen.getByRole("button", { name: "back-to-capsule" }));
    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    expect(wardrobeApi.fetchWardrobeItems).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "open-search" }));
    expect(await screen.findByTestId("search-screen")).toBeInTheDocument();
  });

  test("sign-out clears cached client state and returns to sign-in", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    authApi.fetchProfile.mockResolvedValue({
      profile: {
        formalityLevel: "casual",
        style: "minimalistic",
        occasions: ["office"],
        season: ["summer"],
        audience: "woman",
        color: null,
        pattern: null,
        locale: "en"
      }
    });
    authApi.updateProfileLocale.mockResolvedValue({});
    authApi.logout.mockResolvedValue({});
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sign-out" }));

    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalled();
    expect(authApi.clearRequestCache).toHaveBeenCalled();
    expect(profileOptionsApi.clearProfileOptionsCache).toHaveBeenCalled();
    expect(window.location.pathname).toBe("/");
  });
});
