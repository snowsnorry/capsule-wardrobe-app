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

const mainScreenRender = vi.hoisted(() => vi.fn());

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

vi.mock("./api/auth.js", () => authApi);
vi.mock("./api/profileOptionsCache.js", () => profileOptionsApi);
vi.mock("./api/wardrobe.js", () => wardrobeApi);
vi.mock("./api/capsules.js", () => capsulesApi);

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
    mainScreenRender(props);
    return (
      <div data-testid="main-screen">
        <div>main-screen:{props.items.length}</div>
        <div>active-capsule:{props.activeCapsule?.id || ""}:{props.activeCapsule?.name || ""}</div>
        <div>items-order:{props.items.map((item) => item.url).join(",")}</div>
        <button type="button" onClick={() => props.onSelectStyleCore("formal")}>
          change-filter
        </button>
        <button type="button" onClick={props.onApplyFilters}>
          apply-filters
        </button>
        <button type="button" onClick={() => props.onDuplicateCapsule("Copied capsule")}>
          save-as
        </button>
        {props.items.map((item) => (
          <button key={item.url} type="button" onClick={() => props.onToggleRegenerationSelection(item)}>
            select-{item.url}
          </button>
        ))}
        <button type="button" onClick={props.onRegenerateSelectedItems}>
          regenerate-selected
        </button>
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

function createBootstrapResponse({ items = [], locale = "ru" } = {}) {
  return {
    profile: { locale },
    activeCapsule: {
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
          pattern: null
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
          style: "minimalistic",
          occasions: ["office"],
          season: ["spring"],
          audience: "woman",
          color: null,
          pattern: null
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
    mainScreenRender.mockReset();

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
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse());
    capsulesApi.fetchRecentCapsules.mockResolvedValue({ capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }] });
    capsulesApi.fetchCapsule.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
    capsulesApi.createCapsule.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
    capsulesApi.updateCapsuleFilters.mockResolvedValue({ capsule: createBootstrapResponse().activeCapsule });
    capsulesApi.duplicateCapsule.mockResolvedValue({
      capsule: {
        ...createBootstrapResponse().activeCapsule,
        id: "capsule-2",
        name: "Copied capsule",
        draft: null,
        saved: createBootstrapResponse().activeCapsule.draft,
        status: "saved"
      }
    });
    capsulesApi.revertCapsule.mockResolvedValue({
      capsule: {
        ...createBootstrapResponse().activeCapsule,
        draft: null,
        saved: createBootstrapResponse().activeCapsule.draft,
        status: "saved"
      }
    });
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

  test("onboarding creates capsule with filters only and no draft payload", async () => {
    authApi.fetchCurrentUser.mockRejectedValue(new Error("unauthorized"));
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: false });
    authApi.initializeProfile.mockResolvedValue({});
    mockProfileOptions();

    renderApp();

    await screen.findByTestId("sign-in-screen");
    fireEvent.click(screen.getByRole("button", { name: "verify-code" }));
    expect(await screen.findByTestId("onboarding-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "finish-onboarding" }));

    await waitFor(() => {
      expect(capsulesApi.createCapsule).toHaveBeenCalledWith({
        filters: expect.any(Object)
      });
    });
    await waitFor(() => {
      expect(wardrobeApi.regenerateCapsuleWardrobe).toHaveBeenCalledWith({ capsuleId: "capsule-1" });
      expect(wardrobeApi.subscribeCapsuleEvents).toHaveBeenCalled();
    });
    expect(capsulesApi.createCapsule.mock.calls[0][0]).not.toHaveProperty("draft");
  });

  test("bootstraps an existing profile without redundant locale or wardrobe sync and switches between routes", async () => {
    window.history.replaceState({}, "", "/search");
    authApi.fetchCurrentUser.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse({
      items: [
        { id: "top-1", url: "https://example.com/top-1", name: "Shirt", category: "top" }
      ],
      locale: "ru"
    }));
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
      expect(capsulesApi.fetchCapsuleBootstrap).toHaveBeenCalled();
    });
    expect(authApi.updateProfileLocale).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "back-to-capsule" }));
    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    expect(wardrobeApi.subscribeCapsuleEvents).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "open-search" }));
    expect(await screen.findByTestId("search-screen")).toBeInTheDocument();
  });

  test("does not auto-regenerate wardrobe after bootstrap when the active capsule has no stored items", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    authApi.updateProfileLocale.mockResolvedValue({});
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse({ items: [], locale: "en" }));
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(capsulesApi.fetchCapsuleBootstrap).toHaveBeenCalled();
    });
    expect(wardrobeApi.regenerateCapsuleWardrobe).not.toHaveBeenCalled();
    expect(wardrobeApi.subscribeCapsuleEvents).not.toHaveBeenCalled();
  });

  test("does not patch profile locale during bootstrap when the persisted locale already came from the server", async () => {
    authApi.fetchCurrentUser.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    authApi.updateProfileLocale.mockResolvedValue({});
    mockProfileOptions();
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue({
      profile: { locale: "ru" },
      activeCapsule: createBootstrapResponse({ locale: "en" }).activeCapsule,
      capsules: [{ id: "capsule-1", name: "Spring edit", status: "new" }]
    });

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    expect(authApi.updateProfileLocale).not.toHaveBeenCalled();
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

  test("keeps regenerated items in the placeholder slots without moving the remaining cards", async () => {
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
    capsulesApi.fetchCapsuleBootstrap.mockResolvedValue(createBootstrapResponse({
      items: [
        { id: "bottom-1", url: "https://example.com/bottom-1", name: "Trousers", category: "bottom" },
        { id: "top-1", url: "https://example.com/top-1", name: "Shirt", category: "top" },
        { id: "outerwear-1", url: "https://example.com/outerwear-1", name: "Blazer", category: "outerwear" }
      ]
    }));
    wardrobeApi.regenerateSelectedWardrobeItems.mockResolvedValue({ ok: true, status: "pending" });
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("items-order:https://example.com/outerwear-1,https://example.com/top-1,https://example.com/bottom-1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "select-https://example.com/top-1" }));
    fireEvent.click(screen.getByRole("button", { name: "regenerate-selected" }));

    await waitFor(() => {
      expect(wardrobeApi.regenerateSelectedWardrobeItems).toHaveBeenCalledWith({
        itemUrls: ["https://example.com/top-1"],
        capsuleId: "capsule-1"
      });
    });
    wardrobeStream.emit({
      status: "ready",
      items: [
        { id: "bottom-1", url: "https://example.com/bottom-1", name: "Trousers", category: "bottom" },
        { id: "top-2", url: "https://example.com/top-2", name: "New Shirt", category: "top" },
        { id: "outerwear-1", url: "https://example.com/outerwear-1", name: "Blazer", category: "outerwear" }
      ]
    });
    await waitFor(() => {
      expect(screen.getByText("items-order:https://example.com/outerwear-1,https://example.com/top-2,https://example.com/bottom-1")).toBeInTheDocument();
    });
  });

  test("does not write capsule draft before filters are applied", async () => {
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
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();
    capsulesApi.updateCapsuleFilters.mockClear();

    fireEvent.click(screen.getByRole("button", { name: "change-filter" }));

    await waitFor(() => {
      expect(capsulesApi.updateCapsuleFilters).not.toHaveBeenCalled();
    });

    fireEvent.click(screen.getByRole("button", { name: "apply-filters" }));

    await waitFor(() => {
      expect(capsulesApi.updateCapsuleFilters).toHaveBeenCalledTimes(1);
    });
  });

  test("save as duplicates with a provided name without reverting the source capsule", async () => {
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
    mockProfileOptions();

    renderApp();

    expect(await screen.findByTestId("main-screen")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "save-as" }));

    await waitFor(() => {
      expect(capsulesApi.duplicateCapsule).toHaveBeenCalledWith("capsule-1", "Copied capsule");
    });
    await waitFor(() => {
      expect(
        mainScreenRender.mock.calls.some(([props]) => (
          props.activeCapsule?.id === "capsule-2" && props.activeCapsule?.name === "Copied capsule"
        ))
      ).toBe(true);
    });
    expect(capsulesApi.revertCapsule).not.toHaveBeenCalled();
  });
});
