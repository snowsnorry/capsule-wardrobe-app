import type { FormEvent, MouseEvent } from "react";
import {
  fetchProfileStatus,
  logout,
  requestLoginCode,
  signInWithGoogle,
  verifyLoginCode,
} from "../api/auth";
import { clearRequestCache } from "../api/auth";
import { initialStatus } from "./appConstants";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  AuthResultResponse,
  ProfileSettings,
  ProfileStatusResponse,
  StatusState,
  UserLike,
} from "./appTypes";

export type SessionActionContext = {
  bootstrapCapsules: (email?: string) => Promise<unknown>;
  closeNotificationPrompt: () => void;
  code: string;
  email: string;
  ensureOptionsLoaded: (options?: { useFallback?: boolean }) => Promise<void>;
  locale: string;
  maybeShowPasskeyPrompt: () => Promise<void>;
  preloadOnboardingOptions: (options?: {
    useFallback?: boolean;
  }) => Promise<void>;
  resetCapsuleState: () => void;
  resetNavigation: () => void;
  resetOnboardingSelections: () => void;
  resetProfileOptions: () => void;
  resetSessionState: () => void;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  retry: <T>(fn: () => Promise<T>) => Promise<T>;
  setCode: (code: string) => void;
  setHasProfile: (hasProfile: boolean) => void;
  setIsSignOutConfirmOpen: (isOpen: boolean) => void;
  setOnboardingStep: (step: number) => void;
  setProfileCreated: (profileCreated: boolean) => void;
  setSettingsProfile: (profile: ProfileSettings) => void;
  setStatus: (status: StatusState) => void;
  setStep: (step: "email" | "code") => void;
  setUser: (user: UserLike | null) => void;
};

export async function requestCode(
  context: SessionActionContext,
  event: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
) {
  event.preventDefault();
  context.setStatus({
    loading: true,
    error: "",
    infoKey: "",
    infoParams: null,
  });
  try {
    const result = (await requestLoginCode(
      context.email.trim(),
      context.locale,
    )) as AuthResultResponse;
    context.setStatus({
      loading: false,
      error: "",
      infoKey: "auth.codeSent",
      infoParams: {
        minutes: Math.max(
          1,
          Math.ceil((Number(result?.expiresInMs) || 10 * 60000) / 60000),
        ),
      },
    });
    context.setStep("code");
  } catch (error) {
    context.setStatus({
      loading: false,
      error: context.resolveErrorMessage(error),
      infoKey: "",
      infoParams: null,
    });
    context.setCode("");
  }
}

async function prepareSignedInProfile(
  context: SessionActionContext,
  userEmail: string | undefined,
) {
  await Promise.all([
    context.ensureOptionsLoaded({ useFallback: true }),
    context.bootstrapCapsules(userEmail),
  ]);
}

async function prepareOnboardingProfile(
  context: SessionActionContext,
  userEmail: string | undefined,
) {
  await context.preloadOnboardingOptions({ useFallback: true });
  context.setSettingsProfile(normalizeProfileSettings({}, userEmail));
  context.resetOnboardingSelections();
  context.setOnboardingStep(0);
  context.setStatus({
    loading: false,
    error: "",
    infoKey: "",
    infoParams: null,
  });
}

async function applyAuthResult(
  context: SessionActionContext,
  result: AuthResultResponse,
  showPasskeyPrompt: boolean,
) {
  const profileStatus = await context.retry(
    () => fetchProfileStatus() as Promise<ProfileStatusResponse>,
  );
  context.setHasProfile(profileStatus.hasProfile);
  context.setProfileCreated(profileStatus.hasProfile);

  if (!profileStatus.hasProfile) {
    await prepareOnboardingProfile(context, result.user?.email);
    context.setUser(result.user);
    return;
  }

  await prepareSignedInProfile(context, result.user?.email);
  context.setUser(result.user);
  context.setStatus({
    loading: false,
    error: "",
    infoKey: "auth.signedIn",
    infoParams: null,
  });
  if (showPasskeyPrompt) {
    void context.maybeShowPasskeyPrompt();
  }
}

export async function verifyCode(
  context: SessionActionContext,
  event: FormEvent<HTMLFormElement>,
) {
  event.preventDefault();
  context.setStatus({
    loading: true,
    error: "",
    infoKey: "",
    infoParams: null,
  });
  try {
    const result = (await verifyLoginCode(
      context.email.trim(),
      context.code.trim(),
    )) as AuthResultResponse;
    await applyAuthResult(context, result, true);
  } catch (error) {
    context.setUser(null);
    context.setStatus({
      loading: false,
      error: context.resolveErrorMessage(error),
      infoKey: "",
      infoParams: null,
    });
    context.setCode("");
  }
}

export async function googleCredential(
  context: SessionActionContext,
  idToken: string,
) {
  context.setStatus({
    loading: true,
    error: "",
    infoKey: "",
    infoParams: null,
  });
  try {
    const result = (await signInWithGoogle(idToken)) as AuthResultResponse;
    await applyAuthResult(context, result, true);
  } catch (error) {
    context.setUser(null);
    context.setStatus({
      loading: false,
      error: context.resolveErrorMessage(error),
      infoKey: "",
      infoParams: null,
    });
  }
}

export async function passkeySignIn(context: SessionActionContext) {
  context.setStatus({
    loading: true,
    error: "",
    infoKey: "",
    infoParams: null,
  });
  try {
    const { authenticateWithPasskey } = await import("../auth/passkeys");
    const result = (await authenticateWithPasskey()) as AuthResultResponse;
    clearRequestCache();
    await applyAuthResult(context, result, false);
    context.setStatus({
      loading: false,
      error: "",
      infoKey: "auth.signedIn",
      infoParams: null,
    });
  } catch (error) {
    context.setStatus({
      loading: false,
      error: context.resolveErrorMessage(error),
      infoKey: "",
      infoParams: null,
    });
  }
}

export async function signOut(context: SessionActionContext) {
  context.setIsSignOutConfirmOpen(false);
  context.setStatus({
    loading: true,
    error: "",
    infoKey: "",
    infoParams: null,
  });
  try {
    await logout();
    clearRequestCache();
    context.resetSessionState();
    context.resetCapsuleState();
    context.closeNotificationPrompt();
    context.resetProfileOptions();
    context.resetNavigation();
    context.setStatus({
      loading: false,
      error: "",
      infoKey: "auth.signedOut",
      infoParams: null,
    });
  } catch (error) {
    context.setStatus({
      loading: false,
      error: context.resolveErrorMessage(error),
      infoKey: "",
      infoParams: null,
    });
  }
}

export function resetToEmail(context: SessionActionContext) {
  context.setStep("email");
  context.setCode("");
  context.setStatus(initialStatus);
}
