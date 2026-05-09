import { logError } from "../logger.js";
import { buildWardrobeFilters } from "./wardrobeFilters.js";

export function registerProfileReadRoutes(app, context) {
  const { getProfileImpl, requireAuth, toProfileResponse } = context;

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
      return res.json({
        ok: true,
        ...(await buildWardrobeFilters(context, req.user.email)),
      });
    } catch (error) {
      logError("[wardrobe/filters]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}
