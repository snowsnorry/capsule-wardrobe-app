import { useEffect, useRef } from "react";
import { fetchCurrentUser, initializeProfile } from "../api/auth";
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
  locale: string;
  setHasProfile: (hasProfile: boolean) => void;
  setIsCheckingSession: (isCheckingSession: boolean) => void;
  setProfileCreated: (profileCreated: boolean) => void;
  setSessionInitialized: (sessionInitialized: boolean) => void;
  setSettingsProfile: (profile: ProfileSettings) => void;
  setUser: (user: UserLike | null) => void;
};

async function initializeFirstLoginProfile(
  options: UseSessionBootstrapOptions,
  user: UserLike,
) {
  const result = (await initializeProfile(options.locale)) as {
    profile?: Partial<ProfileSettings>;
  };
  options.setSettingsProfile(
    normalizeProfileSettings(result.profile, user.email),
  );
  await options.ensureOptionsLoaded();
  options.setHasProfile(true);
  options.setProfileCreated(true);
}

async function loadProfileState(
  options: UseSessionBootstrapOptions,
  user: UserLike | null,
) {
  const bootstrap = await options.bootstrapCapsules(user?.email);

  if (!bootstrap.hasProfile) {
    if (user) {
      await initializeFirstLoginProfile(options, user);
    }
    return;
  }

  options.setHasProfile(true);
  options.setProfileCreated(true);
  if (!bootstrap.optionsLoaded) {
    await options.ensureOptionsLoaded();
  }
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
