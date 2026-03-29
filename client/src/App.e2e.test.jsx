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
        <button
          type="button"
          onClick={() => {
            props.onEmailChange("flow@example.com");
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
            props.onEmailChange("flow@example.com");
            props.onCodeChange("123456");
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
        <button
          type="button"
          onClick={() => {
            props.onSelectStyleCore("casual");
            props.onToggleOccasion("office");
            props.onToggleSeason("summer");
            props.onSelectAudience("woman");
            queueMicrotask(() => {
              props.onFinish();
            });
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
        <div>items:{props.items.length}</div>
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
    seasons: ["summer"],
    audience: ["woman", "man", "any"],
    patterns: ["solid"]
  });
}

describe("App e2e-style flows", () => {
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

    authApi.updateProfileLocale.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
  });

  test("covers auth happy path through onboarding, wardrobe load, search navigation, and sign-out", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "flow@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: false });
    authApi.initializeProfile.mockResolvedValue({});
    authApi.logout.mockResolvedValue({});
    mockProfileOptions();
    wardrobeApi.fetchWardrobeItems.mockResolvedValue({
      items: [{ id: "item-1", name: "Linen Shirt", category: "top" }],
      status: "ready"
    });

    renderApp();

    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "request-code" }));
    await waitFor(() => {
      expect(authApi.requestLoginCode).toHaveBeenCalledWith(expect.any(String), "en");
    });

    fireEvent.click(screen.getByRole("button", { name: "verify-code" }));
    expect(await screen.findByTestId("onboarding-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "finish-onboarding" }));

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(authApi.initializeProfile).toHaveBeenCalledTimes(1);
      expect(wardrobeApi.fetchWardrobeItems).toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "open-search" }));
    expect(await screen.findByTestId("search-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "back-to-capsule" }));
    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "sign-out" }));
    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(authApi.clearRequestCache).toHaveBeenCalledTimes(1);
    expect(profileOptionsApi.clearProfileOptionsCache).toHaveBeenCalledTimes(1);
  });
});
