import { SUPPORTED_LOCALES } from "../appConfig.js";
import {
  clearPasskeyChallengeCookie,
  clearSessionCookie,
} from "../httpCookies.js";
import { logError } from "../logger.js";

function getSupportedLocale(value: unknown): string | null {
  const locale = String(value || "")
    .trim()
    .toLowerCase();
  return SUPPORTED_LOCALES.has(locale) ? locale : null;
}

export function createInitializeProfileHandler({
  createProfileImpl,
  toProfileResponse,
}) {
  return async (req, res) => {
    const locale = getSupportedLocale(req.body?.locale);
    if (!locale) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const profile = await createProfileImpl(req.user.email, { locale });
      if (!profile) {
        return res.status(409).json({ error: "profile_exists" });
      }
      return res.json({ ok: true, profile: toProfileResponse(profile) });
    } catch (error) {
      logError("[profile/initialize]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}

export function createUpdateProfileHandler({
  normalizeProfileSettingsPayload,
  toProfileResponse,
  updateProfileImpl,
}) {
  return async (req, res) => {
    const payload = normalizeProfileSettingsPayload(req.body);
    if (!payload) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const profile = await updateProfileImpl(req.user.email, payload);
      if (!profile) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.json({ ok: true, profile: toProfileResponse(profile) });
    } catch (error) {
      logError("[profile/update]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}

export function createUpdateProfileLocaleHandler({
  toProfileResponse,
  updateProfileLocaleImpl,
}) {
  return async (req, res) => {
    const locale = getSupportedLocale(req.body?.locale);
    if (!locale) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const profile = await updateProfileLocaleImpl(req.user.email, locale);
      if (!profile) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.json({ ok: true, profile: toProfileResponse(profile) });
    } catch (error) {
      logError("[profile/locale]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}

export function createDeleteProfileHandler({
  clearAccountTransientStateImpl,
  deleteProfileImpl,
  deleteR2ObjectsImpl,
  listUploadedWardrobeR2KeysImpl,
  nodeEnv,
}) {
  return async (req, res) => {
    try {
      const imageKeys = await listUploadedWardrobeR2KeysImpl({
        email: req.user.email,
      });
      const deleted = await deleteProfileImpl(req.user.email);
      if (!deleted) {
        return res.status(404).json({ error: "not_found" });
      }
      clearAccountTransientStateImpl?.(req.user.email);
      if (imageKeys.length > 0) {
        await deleteR2ObjectsImpl({ keys: imageKeys }).catch((error) => {
          logError("[profile/delete][r2]", error);
        });
      }
      clearSessionCookie(res, nodeEnv);
      clearPasskeyChallengeCookie(res, nodeEnv);
      return res.json({ ok: true });
    } catch (error) {
      logError("[profile/delete]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}
