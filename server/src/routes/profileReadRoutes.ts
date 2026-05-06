import { logError } from "../logger.js";

export function registerProfileReadRoutes(app, context) {
  const {
    getAudienceOptionsImpl,
    getFormalityLevelsImpl,
    getOccasionsImpl,
    getPatternOptionsImpl,
    getProfileImpl,
    getSeasonsImpl,
    getStylesImpl,
    hasProfileImpl,
    requireAuth,
    toProfileResponse
  } = context;

app.get("/profile/status", requireAuth, async (req, res) => {
  try {
    const exists = await hasProfileImpl(req.user.email);
    return res.json({ ok: true, hasProfile: exists });
  } catch (error) {
    logError("[profile/status]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/profile/me", requireAuth, async (req, res) => {
  try {
    const profile = await getProfileImpl(req.user.email);
    if (!profile) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, profile: toProfileResponse(profile) });
  } catch (error) {
    logError("[profile/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/wardrobe/filters", requireAuth, async (req, res) => {
  try {
    const [formalityLevels, styles, occasions, seasons, patterns] = await Promise.all([
      getFormalityLevelsImpl(req.user.email),
      getStylesImpl(req.user.email),
      getOccasionsImpl(req.user.email),
      getSeasonsImpl(req.user.email),
      getPatternOptionsImpl(req.user.email)
    ]);
    return res.json({
      ok: true,
      formalityLevels,
      styles,
      occasions,
      seasons,
      audience: getAudienceOptionsImpl(),
      patterns
    });
  } catch (error) {
    logError("[wardrobe/filters]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});


}
