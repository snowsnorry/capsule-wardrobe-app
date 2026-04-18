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

const wardrobeStream = vi.hoisted(() => ({
  listeners: new Set(),
  emit(data, event = "snapshot") {
    for (const listener of this.listeners) {
      listener({ event, data });
    }
  },
  reset() {
    this.listeners.clear();
  }
}));

const wardrobeApi = vi.hoisted(() => ({
  subscribeCapsuleEvents: vi.fn(),
  regenerateCapsuleWardrobe: vi.fn(),
  regenerateSelectedWardrobeItems: vi.fn()
}));

const notificationApi = vi.hoisted(() => {
  const api = {
    permission: "default",
    nextPermission: "default",
    created: vi.fn(),
    requestPermission: vi.fn(async () => {
      api.permission = api.nextPermission;
      return api.permission;
    }),
    reset() {
      api.permission = "default";
      api.nextPermission = "default";
      api.created.mockReset();
      api.requestPermission.mockClear();
    }
  };
  return api;
});

const capsulesApi = vi.hoisted(() => ({
  createCapsule: vi.fn(),
  deleteCapsule: vi.fn(),
  downloadCapsulePdf: vi.fn(),
  duplicateCapsule: vi.fn(),
  fetchCapsule: vi.fn(),
  fetchCapsuleBootstrap: vi.fn(),
  fetchRecentCapsules: vi.fn(),
  renameCapsule: vi.fn(),
  revertCapsule: vi.fn(),
  saveCapsule: vi.fn(),
  searchCapsules: vi.fn(),
  selectCapsule: vi.fn(),
  updateCapsuleFilters: vi.fn(),
  updateCapsuleRejectedUrls: vi.fn()
}));

vi.mock("./api/auth", () => authApi);
vi.mock("./api/profileOptionsCache.js", () => profileOptionsApi);
vi.mock("./api/wardrobe", () => wardrobeApi);
vi.mock("./api/capsules", () => capsulesApi);

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

function installNotificationMock() {
  function MockNotification(title, options) {
    notificationApi.created(title, options);
  }

  Object.defineProperty(MockNotification, "permission", {
    configurable: true,
    get() {
      return notificationApi.permission;
    }
  });
  MockNotification.requestPermission = notificationApi.requestPermission;
  globalThis.Notification = MockNotification;
  window.Notification = MockNotification;
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

function createBootstrapResponse({ items = [], locale = "en", llm = "openai:gpt-5.2" } = {}) {
  return {
    profile: { locale, llm },
    activeCapsule: {
      id: "capsule-1",
      name: "Spring edit",
      draft: {
        filters: {
          formalityLevel: "casual",
          style: null,
          occasions: ["office"],
          season: ["summer"],
          audience: "woman",
          color: null,
          pattern: "solid"
        },
        data: {
          wardrobe: { items },
          rejectedUrls: []
        }
      },
      saved: null,
      effective: {
        filters: {
          formalityLevel: "casual",
          style: null,
          occasions: ["office"],
          season: ["summer"],
          audience: "woman",
          color: null,
          pattern: "solid"
        },
        data: {
          wardrobe: { items },
          rejectedUrls: []
        }
      },
      status: "new"
    },
    capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }]
  };
}

describe("App e2e-style flows", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    cleanup();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
    notificationApi.reset();
    installNotificationMock();

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

    wardrobeStream.reset();
    wardrobeApi.subscribeCapsuleEvents.mockReset();
    wardrobeApi.regenerateCapsuleWardrobe.mockReset();
    wardrobeApi.regenerateSelectedWardrobeItems.mockReset();
    Object.values(capsulesApi).forEach((mockFn) => mockFn.mockReset());

    wardrobeApi.subscribeCapsuleEvents.mockImplementation(({ onMessage, signal }) => {
      wardrobeStream.listeners.add(onMessage);
      signal?.addEventListener("abort", () => {
        wardrobeStream.listeners.delete(onMessage);
      }, { once: true });
      return new Promise(() => {});
    });
    wardrobeApi.regenerateCapsuleWardrobe.mockResolvedValue({ ok: true, status: "pending" });
    wardrobeApi.regenerateSelectedWardrobeItems.mockResolvedValue({ ok: true, status: "pending" });

    authApi.updateProfileLocale.mockResolvedValue({});
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse());
    capsulesApi.fetchRecentCapsules.mockResolvedValue({ capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }] });
    capsulesApi.fetchCapsule.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
    capsulesApi.createCapsule.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
    capsulesApi.updateCapsuleFilters.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
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
      expect(capsulesApi.createCapsule).toHaveBeenCalledWith({
        filters: expect.any(Object)
      });
      expect(wardrobeApi.regenerateCapsuleWardrobe).toHaveBeenCalledWith({ capsuleId: "capsule-1" });
      expect(wardrobeApi.subscribeCapsuleEvents).toHaveBeenCalled();
    });
    expect(capsulesApi.createCapsule.mock.calls[0][0]).not.toHaveProperty("draft");

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

  test("shows notification prompt during pending onboarding generation and sends ready notification after permission is granted", async () => {
    notificationApi.nextPermission = "granted";
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "flow@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: false });
    authApi.initializeProfile.mockResolvedValue({});
    authApi.logout.mockResolvedValue({});
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse({ locale: "en", llm: "openai:gpt-5.2" }));
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("sign-in-screen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "verify-code" }));
    expect(await screen.findByTestId("onboarding-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "finish-onboarding" }));

    expect(await screen.findByText("Capsule generation usually takes about a minute. Enable notifications and we will let you know when your result is ready.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Enable notifications" }));

    await waitFor(() => {
      expect(notificationApi.requestPermission).toHaveBeenCalledTimes(1);
    });

    wardrobeStream.emit({ status: "ready", items: [] });

    await waitFor(() => {
      expect(notificationApi.created).toHaveBeenCalledWith("Your capsule is ready", {
        body: "Your new capsule is ready to review. Open the app to see the result."
      });
    });
    await waitFor(() => {
      expect(screen.queryByText("Capsule generation usually takes about a minute. Enable notifications and we will let you know when your result is ready.")).not.toBeInTheDocument();
    });
  });
});
