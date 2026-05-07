import { useEffect, useRef } from "react";
import { fetchCurrentUser, fetchProfileStatus } from "../api/auth";
import { normalizeProfileSettings } from "./profileSettings";
import type {
  CurrentUserResponse,
  ProfileSettings,
  ProfileStatusResponse,
  UserLike,
} from "./appTypes";

type UseSessionBootstrapOptions = {
  bootstrapCapsules: (email?: string) => Promise<ProfileSettings>;
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
  const profileStatus = (await fetchProfileStatus()) as ProfileStatusResponse;
  options.setHasProfile(profileStatus.hasProfile);
  options.setProfileCreated(profileStatus.hasProfile);

  if (!profileStatus.hasProfile) {
    await options.preloadOnboardingOptions();
    return;
  }

  await Promise.all([
    options.ensureOptionsLoaded(),
    options.bootstrapCapsules(user?.email),
  ]);
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
        currentOptions.setUser(current.user);
        await loadProfileState(currentOptions, current.user);
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
