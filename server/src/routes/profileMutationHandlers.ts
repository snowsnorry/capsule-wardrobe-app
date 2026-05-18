import { SUPPORTED_LOCALES } from "../appConfig.js";
import {
  clearPasskeyChallengeCookie,
  clearSessionCookie,
} from "../httpCookies.js";
import { logError } from "../logger.js";
import { buildUploadedWardrobeItemImageKeys } from "./wardrobeUploadedItemUpdateRoute.js";

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

function buildAccountWardrobeImageKeys(items: unknown[] = []): string[] {
  return Array.from(
    new Set(
      items
        .filter((item) => {
          const source =
            typeof item === "object" && item !== null
              ? (item as { source?: unknown }).source
              : null;
          return source === "uploaded";
        })
        .flatMap((item) => buildUploadedWardrobeItemImageKeys(item)),
    ),
  );
}

export function createDeleteProfileHandler({
  clearAccountTransientStateImpl,
  deleteProfileImpl,
  deleteR2ObjectsImpl,
  listWardrobeItemsImpl,
  nodeEnv,
}) {
  return async (req, res) => {
    try {
      const wardrobeItems = await listWardrobeItemsImpl({
        email: req.user.email,
        source: "uploaded",
      });
      const deleted = await deleteProfileImpl(req.user.email);
      if (!deleted) {
        return res.status(404).json({ error: "not_found" });
      }
      clearAccountTransientStateImpl?.(req.user.email);
      const imageKeys = buildAccountWardrobeImageKeys(wardrobeItems);
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

export { buildAccountWardrobeImageKeys };
