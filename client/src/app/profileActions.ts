import { deleteProfile, initializeProfile, updateProfile } from "../api/auth";
import { createCapsule } from "../api/capsules";
import { regenerateCapsuleWardrobe } from "../api/wardrobe";
import { buildProfileSettingsPayload, normalizeProfileSettings } from "./profileSettings";
import { fromContext, type AppActionContext } from "./actionContext";
import type {
  CapsuleDraft,
  CapsuleMutationResponse,
  ProfileSettings,
  WardrobeMutationResponse
} from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";

export function nextOnboarding(context: AppActionContext) {
  const step = fromContext<number>(context, "onboardingStep");
  if (step === 0 && !fromContext<string>(context, "selectedFormalityLevel")) return;
  if (step === 1 && fromContext<string[]>(context, "selectedOccasions").length === 0) return;
  if (step === 2 && fromContext<string[]>(context, "selectedSeason").length === 0) return;
  if (step === 3 && !fromContext<string>(context, "selectedAudience")) return;
  fromContext<(updater: (prev: number) => number) => void>(context, "setOnboardingStep")((prev) => Math.min(prev + 1, 3));
}

export function backOnboarding(context: AppActionContext) {
  fromContext<(updater: (prev: number) => number) => void>(context, "setOnboardingStep")((prev) => Math.max(prev - 1, 0));
}

function resetWardrobeView(context: AppActionContext) {
  fromContext<(value: null) => void>(context, "setProfileItems")(null);
  fromContext<(value: []) => void>(context, "setProfileOutfitSets")([]);
  fromContext<(value: []) => void>(context, "setPendingImageSetIndexes")([]);
  fromContext<(value: []) => void>(context, "setSelectedRegenerationUrls")([]);
  fromContext<(value: []) => void>(context, "setPartialRegenerationPendingUrls")([]);
  fromContext<(value: boolean) => void>(context, "setIsPartialRegenerationLoading")(false);
  fromContext<(value: boolean) => void>(context, "setIsWardrobePending")(false);
  fromContext<(value: boolean) => void>(context, "setHasPendingAdditionalItems")(false);
}

export async function finishOnboarding(context: AppActionContext) {
  const setStatus = fromContext<(value: unknown) => void>(context, "setStatus");
  setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
  try {
    await initializeProfile(fromContext<string>(context, "locale"));
    const draft = fromContext<(options?: unknown) => CapsuleDraft>(context, "buildCurrentDraftSnapshot")({
      wardrobe: null,
      rejectedUrls: []
    });
    const created = await createCapsule({ filters: draft.filters }) as CapsuleMutationResponse;
    const createdCapsuleId = String(created?.capsule?.id || "").trim();
    fromContext<(value: boolean) => void>(context, "setProfileCreated")(true);
    fromContext<(value: boolean) => void>(context, "setHasProfile")(true);
    fromContext<(value: string) => void>(context, "setCurrentView")("main");
    resetWardrobeView(context);
    await startInitialWardrobeGeneration(context, createdCapsuleId);
    setStatus({ loading: false, error: "", infoKey: "onboarding.completedHint", infoParams: null });
  } catch (error) {
    setStatus({ loading: false, error: fromContext<(error: unknown) => string>(context, "resolveErrorMessage")(error), infoKey: "", infoParams: null });
  }
}

async function startInitialWardrobeGeneration(context: AppActionContext, capsuleId: string) {
  const normalizedProfile = await fromContext<(email?: string) => Promise<ProfileSettings>>(context, "bootstrapCapsules")(
    fromContext<{ email?: string } | null>(context, "user")?.email
  );
  if (!capsuleId) return;

  fromContext<{ current: string }>(context, "manualWardrobeRegenerationCapsuleIdRef").current = capsuleId;
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(true);
  const response = await regenerateCapsuleWardrobe({ capsuleId }) as WardrobeMutationResponse;
  if (response?.status === "pending") {
    fromContext<(kind: string, llm?: string) => void>(context, "startPendingNotificationFlow")("full", normalizedProfile?.llm);
    fromContext<(capsuleId: string) => void>(context, "startCapsuleEventStream")(capsuleId);
    return;
  }
  fromContext<(value: boolean) => void>(context, "setIsLoadingItems")(false);
}

export async function saveSettings(context: AppActionContext, nextSettings: SettingsSavePayload) {
  const locale = fromContext<string>(context, "locale");
  const setStatus = fromContext<(value: unknown) => void>(context, "setStatus");
  const settingsProfile = fromContext<ProfileSettings>(context, "settingsProfile");
  const payload = buildProfileSettingsPayload(nextSettings, settingsProfile, locale);

  setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
  try {
    const result = await updateProfile(payload) as { profile?: Partial<ProfileSettings> };
    const normalized = normalizeProfileSettings(result.profile, fromContext<{ email?: string } | null>(context, "user")?.email);
    fromContext<(profile: ProfileSettings) => void>(context, "setSettingsProfile")(normalized);
    if (normalized.locale && normalized.locale !== locale) {
      fromContext<(locale: string) => void>(context, "setLocale")(normalized.locale);
    }
    setStatus({ loading: false, error: "", infoKey: "settings.saved", infoParams: null });
    return normalized;
  } catch (error) {
    const message = fromContext<(error: unknown) => string>(context, "resolveErrorMessage")(error);
    setStatus({ loading: false, error: message, infoKey: "", infoParams: null });
    throw new Error(message, { cause: error });
  }
}

export async function deleteUserProfile(context: AppActionContext) {
  const setStatus = fromContext<(value: unknown) => void>(context, "setStatus");
  setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
  try {
    await deleteProfile();
    await fromContext<() => Promise<void>>(context, "handleLogout")();
  } catch (error) {
    setStatus({ loading: false, error: fromContext<(error: unknown) => string>(context, "resolveErrorMessage")(error), infoKey: "", infoParams: null });
  }
}
