import { beforeEach, describe, expect, test, vi } from "vitest";
import { requestCode, signOut, verifyCode, type SessionActionContext } from "./sessionActions";
import { createTestProfile, testStatus } from "./testUtils";

const authApi = vi.hoisted(() => ({
  clearRequestCache: vi.fn(),
  fetchProfileStatus: vi.fn(),
  logout: vi.fn(),
  requestLoginCode: vi.fn(),
  verifyLoginCode: vi.fn()
}));

vi.mock("../api/auth", () => authApi);

function createSessionContext(overrides: Partial<SessionActionContext> = {}): SessionActionContext {
  return {
    bootstrapCapsules: vi.fn(async () => createTestProfile()),
    closeNotificationPrompt: vi.fn(),
    code: "654321",
    email: "person@example.com",
    ensureOptionsLoaded: vi.fn(async () => undefined),
    locale: "en",
    maybeShowPasskeyPrompt: vi.fn(async () => undefined),
    preloadOnboardingOptions: vi.fn(async () => undefined),
    resetCapsuleState: vi.fn(),
    resetNavigation: vi.fn(),
    resetOnboardingSelections: vi.fn(),
    resetProfileOptions: vi.fn(),
    resetSessionState: vi.fn(),
    resolveErrorMessage: vi.fn((error) => error?.message || "resolved error"),
    retry: vi.fn((fn) => fn()),
    setCode: vi.fn(),
    setHasProfile: vi.fn(),
    setIsSignOutConfirmOpen: vi.fn(),
    setOnboardingStep: vi.fn(),
    setProfileCreated: vi.fn(),
    setSettingsProfile: vi.fn(),
    setStatus: vi.fn(),
    setStep: vi.fn(),
    setUser: vi.fn(),
    ...overrides
  };
}

describe("sessionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("requestCode sends the trimmed email with current locale and moves to code step", async () => {
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    const context = createSessionContext({ email: " person@example.com " });

    await requestCode(context, { preventDefault: vi.fn() } as never);

    expect(authApi.requestLoginCode).toHaveBeenCalledWith("person@example.com", "en");
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "",
      infoKey: "auth.codeSent",
      infoParams: { minutes: 5 }
    });
    expect(context.setStep).toHaveBeenCalledWith("code");
  });

  test("verifyCode prepares onboarding when the signed-in user has no profile", async () => {
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: false });
    const context = createSessionContext();

    await verifyCode(context, { preventDefault: vi.fn() } as never);

    expect(authApi.verifyLoginCode).toHaveBeenCalledWith("person@example.com", "654321");
    expect(context.preloadOnboardingOptions).toHaveBeenCalledWith({ useFallback: true });
    expect(context.resetOnboardingSelections).toHaveBeenCalled();
    expect(context.setOnboardingStep).toHaveBeenCalledWith(0);
    expect(context.setHasProfile).toHaveBeenCalledWith(false);
    expect(context.setUser).toHaveBeenCalledWith({ email: "person@example.com" });
  });

  test("verifyCode bootstraps an existing profile and can show the passkey prompt", async () => {
    authApi.verifyLoginCode.mockResolvedValue({ user: { email: "person@example.com" } });
    authApi.fetchProfileStatus.mockResolvedValue({ hasProfile: true });
    const context = createSessionContext();

    await verifyCode(context, { preventDefault: vi.fn() } as never);

    expect(context.ensureOptionsLoaded).toHaveBeenCalledWith({ useFallback: true });
    expect(context.bootstrapCapsules).toHaveBeenCalledWith("person@example.com");
    expect(context.setStatus).toHaveBeenLastCalledWith({ loading: false, error: "", infoKey: "auth.signedIn", infoParams: null });
    expect(context.maybeShowPasskeyPrompt).toHaveBeenCalled();
  });

  test("signOut clears cached client state and resets navigation/profile options", async () => {
    authApi.logout.mockResolvedValue({});
    const context = createSessionContext();

    await signOut(context);

    expect(context.setIsSignOutConfirmOpen).toHaveBeenCalledWith(false);
    expect(authApi.logout).toHaveBeenCalledTimes(1);
    expect(authApi.clearRequestCache).toHaveBeenCalledTimes(1);
    expect(context.resetSessionState).toHaveBeenCalled();
    expect(context.resetCapsuleState).toHaveBeenCalled();
    expect(context.closeNotificationPrompt).toHaveBeenCalled();
    expect(context.resetProfileOptions).toHaveBeenCalled();
    expect(context.resetNavigation).toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenLastCalledWith({ ...testStatus, infoKey: "auth.signedOut" });
  });
});
