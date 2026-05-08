import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  googleCredential,
  passkeySignIn,
  requestCode,
  resetToEmail,
  signOut,
  verifyCode,
  type SessionActionContext,
} from "./sessionActions";
import { createTestProfile, testStatus } from "./testUtils";

const authApi = vi.hoisted(() => ({
  clearRequestCache: vi.fn(),
  logout: vi.fn(),
  requestLoginCode: vi.fn(),
  signInWithGoogle: vi.fn(),
  verifyLoginCode: vi.fn(),
}));

vi.mock("../api/auth", () => authApi);

const mainScreenLoader = vi.hoisted(() => ({
  preloadMainScreen: vi.fn(),
  shouldPreloadMainScreenForCurrentPath: vi.fn(() => true),
}));

vi.mock("./mainScreenLoader", () => mainScreenLoader);

const passkeyAuth = vi.hoisted(() => ({
  authenticateWithPasskey: vi.fn(),
}));

vi.mock("../auth/passkeys", () => passkeyAuth);

function createSessionContext(
  overrides: Partial<SessionActionContext> = {},
): SessionActionContext {
  return {
    bootstrapCapsules: vi.fn(async () => ({
      ...createTestProfile(),
      hasProfile: true,
    })),
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
    ...overrides,
  };
}

describe("sessionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainScreenLoader.shouldPreloadMainScreenForCurrentPath.mockReturnValue(
      true,
    );
  });

  test("requestCode sends the trimmed email with current locale and moves to code step", async () => {
    authApi.requestLoginCode.mockResolvedValue({ expiresInMs: 300000 });
    const context = createSessionContext({ email: " person@example.com " });

    await requestCode(context, { preventDefault: vi.fn() } as never);

    expect(authApi.requestLoginCode).toHaveBeenCalledWith(
      "person@example.com",
      "en",
    );
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "",
      infoKey: "auth.codeSent",
      infoParams: { minutes: 5 },
    });
    expect(context.setStep).toHaveBeenCalledWith("code");
  });

  test("verifyCode prepares onboarding when the signed-in user has no profile", async () => {
    authApi.verifyLoginCode.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    const context = createSessionContext({
      bootstrapCapsules: vi.fn(async () => ({
        ...createTestProfile(),
        hasProfile: false,
      })),
    });

    await verifyCode(context, { preventDefault: vi.fn() } as never);

    expect(authApi.verifyLoginCode).toHaveBeenCalledWith(
      "person@example.com",
      "654321",
    );
    expect(context.preloadOnboardingOptions).toHaveBeenCalledWith({
      useFallback: true,
    });
    expect(context.resetOnboardingSelections).toHaveBeenCalled();
    expect(context.setOnboardingStep).toHaveBeenCalledWith(0);
    expect(context.setHasProfile).toHaveBeenCalledWith(false);
    expect(context.setUser).toHaveBeenCalledWith({
      email: "person@example.com",
    });
    expect(mainScreenLoader.preloadMainScreen).toHaveBeenCalledTimes(1);
  });

  test("verifyCode bootstraps an existing profile and can show the passkey prompt", async () => {
    authApi.verifyLoginCode.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    const context = createSessionContext();

    await verifyCode(context, { preventDefault: vi.fn() } as never);

    expect(context.ensureOptionsLoaded).toHaveBeenCalledWith({
      useFallback: true,
    });
    expect(context.bootstrapCapsules).toHaveBeenCalledWith(
      "person@example.com",
    );
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "",
      infoKey: "auth.signedIn",
      infoParams: null,
    });
    expect(context.maybeShowPasskeyPrompt).toHaveBeenCalled();
    expect(mainScreenLoader.preloadMainScreen).toHaveBeenCalledTimes(1);
  });

  test("verifyCode skips MainScreen preload when the current route cannot render it", async () => {
    authApi.verifyLoginCode.mockResolvedValue({
      user: { email: "person@example.com" },
    });
    mainScreenLoader.shouldPreloadMainScreenForCurrentPath.mockReturnValue(
      false,
    );
    const context = createSessionContext();

    await verifyCode(context, { preventDefault: vi.fn() } as never);

    expect(mainScreenLoader.preloadMainScreen).not.toHaveBeenCalled();
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
    expect(context.setStatus).toHaveBeenLastCalledWith({
      ...testStatus,
      infoKey: "auth.signedOut",
    });
  });

  test("requestCode and verifyCode map failures and clear stale codes", async () => {
    authApi.requestLoginCode.mockRejectedValueOnce(new Error("invalid_email"));
    const requestContext = createSessionContext();
    await requestCode(requestContext, { preventDefault: vi.fn() } as never);
    expect(requestContext.setCode).toHaveBeenCalledWith("");
    expect(requestContext.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "invalid_email",
      infoKey: "",
      infoParams: null,
    });

    authApi.verifyLoginCode.mockRejectedValueOnce(new Error("expired"));
    const verifyContext = createSessionContext();
    await verifyCode(verifyContext, { preventDefault: vi.fn() } as never);
    expect(verifyContext.setUser).toHaveBeenCalledWith(null);
    expect(verifyContext.setCode).toHaveBeenCalledWith("");
  });

  test("googleCredential applies auth results and reports failures", async () => {
    authApi.signInWithGoogle.mockResolvedValueOnce({
      user: { email: "person@example.com" },
    });
    const context = createSessionContext();

    await googleCredential(context, "token-1");

    expect(authApi.signInWithGoogle).toHaveBeenCalledWith("token-1");
    expect(context.bootstrapCapsules).toHaveBeenCalledWith(
      "person@example.com",
    );

    authApi.signInWithGoogle.mockRejectedValueOnce(
      new Error("invalid_google_token"),
    );
    await googleCredential(context, "bad-token");
    expect(context.setUser).toHaveBeenCalledWith(null);
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "invalid_google_token",
      infoKey: "",
      infoParams: null,
    });
  });

  test("passkeySignIn clears request cache and does not show prompt", async () => {
    passkeyAuth.authenticateWithPasskey.mockResolvedValueOnce({
      user: { email: "person@example.com" },
    });
    const context = createSessionContext();

    await passkeySignIn(context);

    expect(passkeyAuth.authenticateWithPasskey).toHaveBeenCalledTimes(1);
    expect(authApi.clearRequestCache).toHaveBeenCalledTimes(1);
    expect(context.maybeShowPasskeyPrompt).not.toHaveBeenCalled();
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "",
      infoKey: "auth.signedIn",
      infoParams: null,
    });

    passkeyAuth.authenticateWithPasskey.mockRejectedValueOnce(
      new Error("passkey_failed"),
    );
    await passkeySignIn(context);
    expect(context.setStatus).toHaveBeenLastCalledWith({
      loading: false,
      error: "passkey_failed",
      infoKey: "",
      infoParams: null,
    });
  });

  test("signOut and resetToEmail handle failures and reset email step", async () => {
    authApi.logout.mockRejectedValueOnce(new Error("network"));
    const context = createSessionContext();

    await signOut(context);
    resetToEmail(context);

    expect(context.setStatus).toHaveBeenCalledWith({
      loading: false,
      error: "network",
      infoKey: "",
      infoParams: null,
    });
    expect(context.setStep).toHaveBeenCalledWith("email");
    expect(context.setCode).toHaveBeenCalledWith("");
    expect(context.setStatus).toHaveBeenLastCalledWith(testStatus);
  });
});
