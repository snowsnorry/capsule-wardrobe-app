import { deleteProfile, updateProfile } from "../api/auth";
import {
  buildProfileSettingsPayload,
  normalizeProfileSettings,
} from "./profileSettings";
import { fromContext, type AppActionContext } from "./actionContext";
import type { ProfileSettings } from "./appTypes";
import type { SettingsSavePayload } from "../components/SettingsDialog";

export async function saveSettings(
  context: AppActionContext,
  nextSettings: SettingsSavePayload,
) {
  const locale = fromContext<string>(context, "locale");
  const setStatus = fromContext<(value: unknown) => void>(context, "setStatus");
  const settingsProfile = fromContext<ProfileSettings>(
    context,
    "settingsProfile",
  );
  const payload = buildProfileSettingsPayload(
    nextSettings,
    settingsProfile,
    locale,
  );

  setStatus({ loading: true, error: "", infoKey: "", infoParams: null });
  try {
    const result = (await updateProfile(payload)) as {
      profile?: Partial<ProfileSettings>;
    };
    const normalized = normalizeProfileSettings(
      result.profile,
      fromContext<{ email?: string } | null>(context, "user")?.email,
    );
    fromContext<(profile: ProfileSettings) => void>(
      context,
      "setSettingsProfile",
    )(normalized);
    if (normalized.locale && normalized.locale !== locale) {
      fromContext<(locale: string) => void>(
        context,
        "setLocale",
      )(normalized.locale);
    }
    setStatus({
      loading: false,
      error: "",
      infoKey: "settings.saved",
      infoParams: null,
    });
    return normalized;
  } catch (error) {
    const message = fromContext<(error: unknown) => string>(
      context,
      "resolveErrorMessage",
    )(error);
    setStatus({
      loading: false,
      error: message,
      infoKey: "",
      infoParams: null,
    });
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
    setStatus({
      loading: false,
      error: fromContext<(error: unknown) => string>(
        context,
        "resolveErrorMessage",
      )(error),
      infoKey: "",
      infoParams: null,
    });
  }
}
