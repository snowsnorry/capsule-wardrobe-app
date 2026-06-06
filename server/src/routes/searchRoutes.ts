import { logError } from "../logger.js";

export function registerSearchRoutes(app, context) {
  const {
    annotateLikedItems,
    getProductsByUrlsInOrderImpl,
    listLikedItemUrlsImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    runSavedSearchImpl,
  } = context;

  registerSearchReadRoutes(app, context);

  app.get(
    "/search/product",
    requireAuth,
    createProductDetailHandler({
      annotateLikedItems,
      getProductsByUrlsInOrderImpl,
      listLikedItemUrlsImpl,
    }),
  );

  app.post(
    "/search/run",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const result = await runSavedSearchImpl(req.user.email, req.body || {});
        const likedUrls = await listLikedItemUrlsImpl(req.user.email);
        return res.json({
          ok: true,
          ...(result && typeof result === "object"
            ? annotateLikedItems(result, likedUrls)
            : {}),
        });
      } catch (error) {
        if (
          error?.code === "invalid_payload" ||
          error?.message === "invalid_payload"
        ) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        logError("[search/run]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  registerSearchStatsRoute(app, context);
}

function registerSearchReadRoutes(app, context) {
  const { getSavedSearchImpl, getSearchOptionsImpl, requireAuth } = context;

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
}

function registerSearchStatsRoute(app, context) {
  const { getSearchStatsImpl, requireAuth, requireCsrf, requireTrustedOrigin } =
    context;

  app.post(
    "/search/stats",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const result = await getSearchStatsImpl(req.user.email, req.body || {});
        return res.json({
          ok: true,
          ...(result && typeof result === "object" ? result : {}),
        });
      } catch (error) {
        if (
          error?.code === "invalid_payload" ||
          error?.message === "invalid_payload"
        ) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        logError("[search/stats]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function createProductDetailHandler({
  annotateLikedItems,
  getProductsByUrlsInOrderImpl,
  listLikedItemUrlsImpl,
}) {
  return async (req, res) => {
    const url = getHttpUrlParam(req.query?.url);
    if (!url) {
      return res.status(400).json({ error: "invalid_payload" });
    }

    try {
      const items = await getProductsByUrlsInOrderImpl([url]);
      const likedUrls = await listLikedItemUrlsImpl(req.user.email);
      return res.json({
        ok: true,
        item: annotateLikedItems(
          Array.isArray(items) ? items[0] || null : null,
          likedUrls,
        ),
      });
    } catch (error) {
      logError("[search/product]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  };
}

function getHttpUrlParam(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  if (typeof raw !== "string" || !raw.trim()) {
    return "";
  }

  try {
    const url = new URL(raw.trim());
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}
