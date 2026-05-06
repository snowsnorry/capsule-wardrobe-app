import { logError } from "../logger.js";

export function registerSearchRoutes(app, context) {
  const {
    getSavedSearchImpl,
    getSearchOptionsImpl,
    getSearchStatsImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    runSavedSearchImpl
  } = context;

app.get("/search/options", requireAuth, async (req, res) => {
  try {
    const options = await getSearchOptionsImpl(req.user.email);
    return res.json({ ok: true, ...options });
  } catch (error) {
    logError("[search/options]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/search/me", requireAuth, async (req, res) => {
  try {
    const search = await getSavedSearchImpl(req.user.email);
    return res.json({ ok: true, search });
  } catch (error) {
    logError("[search/me]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/search/run", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const result = await runSavedSearchImpl(req.user.email, req.body || {});
    return res.json({ ok: true, ...(result && typeof result === "object" ? result : {}) });
  } catch (error) {
    if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    logError("[search/run]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.post("/search/stats", requireTrustedOrigin, requireAuth, requireCsrf, async (req, res) => {
  try {
    const result = await getSearchStatsImpl(req.user.email, req.body || {});
    return res.json({ ok: true, ...(result && typeof result === "object" ? result : {}) });
  } catch (error) {
    if (error?.code === "invalid_payload" || error?.message === "invalid_payload") {
      return res.status(400).json({ error: "invalid_payload" });
    }
    logError("[search/stats]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});


}
