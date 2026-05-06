import { SUPPORTED_LOCALES } from "../appConfig.js";
import { logError } from "../logger.js";

export function registerProfileMutationRoutes(app, context) {
  const {
    createProfileImpl,
    deleteProfileImpl,
    normalizeProfileSettingsPayload,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    toProfileResponse,
    updateProfileImpl,
    updateProfileLocaleImpl
  } = context;

app.post("/profile/initialize", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  try {
    const profile = await createProfileImpl(req.user.email, {
      locale
    });
    if (!profile) {
      return res.status(409).json({ error: "profile_exists" });
    }
    return res.json({ ok: true, profile: toProfileResponse(profile) });
  } catch (error) {
    logError("[profile/initialize]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.patch("/profile/me", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
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
});

app.patch("/profile/locale", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  const locale = String(req.body?.locale || "").trim().toLowerCase();
  if (!SUPPORTED_LOCALES.has(locale)) {
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
});

app.delete("/profile/me", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const deleted = await deleteProfileImpl(req.user.email);
    if (!deleted) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true });
  } catch (error) {
    logError("[profile/delete]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});


}
