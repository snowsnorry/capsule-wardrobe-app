import { useEffect, useRef } from "react";
import { fetchCurrentUser } from "../api/auth";
import {
  preloadMainScreen,
  shouldPreloadMainScreenForCurrentPath,
} from "./mainScreenLoader";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  CapsuleBootstrapResult,
  CurrentUserResponse,
  ProfileSettings,
  UserLike,
} from "./appTypes";

type UseSessionBootstrapOptions = {
  bootstrapCapsules: (email?: string) => Promise<CapsuleBootstrapResult>;
  ensureOptionsLoaded: () => Promise<void>;
  preloadOnboardingOptions: () => Promise<void>;
  setHasProfile: (hasProfile: boolean) => void;
  setIsCheckingSession: (isCheckingSession: boolean) => void;
  setProfileCreated: (profileCreated: boolean) => void;
  setSessionInitialized: (sessionInitialized: boolean) => void;
  setSettingsProfile: (profile: ProfileSettings) => void;
  setUser: (user: UserLike | null) => void;
};

async function loadProfileState(
  options: UseSessionBootstrapOptions,
  user: UserLike | null,
) {
  const bootstrap = await options.bootstrapCapsules(user?.email);
  options.setHasProfile(bootstrap.hasProfile);
  options.setProfileCreated(bootstrap.hasProfile);

  if (!bootstrap.hasProfile) {
    await options.preloadOnboardingOptions();
    return;
  }

  await options.ensureOptionsLoaded();
}

export function useSessionBootstrap(options: UseSessionBootstrapOptions) {
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    let isActive = true;
    const bootstrapSession = async () => {
      const currentOptions = optionsRef.current;
      currentOptions.setIsCheckingSession(true);
      try {
        const current = (await fetchCurrentUser()) as CurrentUserResponse;
        if (!isActive) return;
        const user = current.user || null;
        currentOptions.setUser(user);
        if (!user) {
          currentOptions.setHasProfile(false);
          currentOptions.setSettingsProfile(normalizeProfileSettings());
          return;
        }
        if (shouldPreloadMainScreenForCurrentPath()) {
          preloadMainScreen();
        }
        await loadProfileState(currentOptions, user);
      } catch {
        if (!isActive) return;
        currentOptions.setUser(null);
        currentOptions.setHasProfile(false);
        currentOptions.setSettingsProfile(normalizeProfileSettings());
      } finally {
        if (isActive) {
          currentOptions.setIsCheckingSession(false);
          currentOptions.setSessionInitialized(true);
        }
      }
    };

    bootstrapSession();

    return () => {
      isActive = false;
    };
  }, []);
}
