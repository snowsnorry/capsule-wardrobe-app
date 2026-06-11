import { logError } from "../logger.js";
import { registerOutfitMutationRoutes } from "./outfitMutationRoutes.js";
import { buildAnnotatedOutfitResponse } from "./outfitRouteResponses.js";

const DEFAULT_OUTFIT_PAGE_LIMIT = 10;
const MAX_OUTFIT_PAGE_LIMIT = 50;

function normalizeIntegerParam(value: unknown, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeOutfitPaginationRequest(query: Record<string, unknown> = {}) {
  const limit = Math.min(
    MAX_OUTFIT_PAGE_LIMIT,
    Math.max(1, normalizeIntegerParam(query.limit, DEFAULT_OUTFIT_PAGE_LIMIT)),
  );
  const offset = normalizeIntegerParam(query.offset, 0);
  return { limit, offset };
}

function buildOutfitPaginationResponse(
  { limit, offset }: { limit: number; offset: number },
  total: number,
) {
  return {
    limit,
    offset,
    total,
    hasMore: offset + limit < total,
  };
}

function registerOutfitBootstrapRoute(app, context) {
  const {
    countOutfitsImpl,
    listRecentOutfitsImpl,
    requireAuth,
    toOutfitSummary,
  } = context;
  app.get("/outfits/bootstrap", requireAuth, async (req, res) => {
    try {
      const paginationRequest = normalizeOutfitPaginationRequest();
      const outfits = await listRecentOutfitsImpl(
        req.user.email,
        paginationRequest.limit,
        paginationRequest.offset,
      );
      const total = await countOutfitsImpl(req.user.email);
      return res.json({
        ok: true,
        outfits: outfits.map(toOutfitSummary),
        pagination: buildOutfitPaginationResponse(paginationRequest, total),
      });
    } catch (error) {
      logError("[outfits/bootstrap]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerOutfitRecentRoute(app, context) {
  const {
    countOutfitsImpl,
    listRecentOutfitsImpl,
    requireAuth,
    toOutfitSummary,
  } = context;

  app.get("/outfits/recent", requireAuth, async (req, res) => {
    try {
      const paginationRequest = normalizeOutfitPaginationRequest(req.query);
      const outfits = await listRecentOutfitsImpl(
        req.user.email,
        paginationRequest.limit,
        paginationRequest.offset,
      );
      const total = await countOutfitsImpl(req.user.email);
      return res.json({
        ok: true,
        outfits: outfits.map(toOutfitSummary),
        pagination: buildOutfitPaginationResponse(paginationRequest, total),
      });
    } catch (error) {
      logError("[outfits/recent]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerOutfitSearchRoute(app, context) {
  const {
    listRecentOutfitsImpl,
    requireAuth,
    searchOutfitsImpl,
    toOutfitSummary,
  } = context;

  app.get("/outfits/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query?.q || "").trim();
      const outfits = query
        ? await searchOutfitsImpl(req.user.email, query, 25)
        : await listRecentOutfitsImpl(req.user.email, 25);
      return res.json({ ok: true, outfits: outfits.map(toOutfitSummary) });
    } catch (error) {
      logError("[outfits/search]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerOutfitEventRoute(app, context) {
  const { getOutfitImpl, requireAuth } = context;

  app.get("/outfits/:id/events", requireAuth, async (req, res) => {
    try {
      const outfit = await getOutfitImpl(req.user.email, req.params.id);
      if (!outfit) {
        return res.status(404).json({ error: "not_found" });
      }
      return context.streamOutfitEventsImpl(req, res, {
        email: req.user.email,
        capsuleId: req.params.id,
        snapshot: async () => {
          const latestOutfit =
            (await getOutfitImpl(req.user.email, req.params.id)) || outfit;
          const pendingImage = Boolean(
            context.getOutfitImageJobImpl?.(req.user.email, req.params.id),
          );
          return {
            status: pendingImage ? "pending" : "ready",
            pendingImage,
            outfit: await buildAnnotatedOutfitResponse(
              latestOutfit,
              req,
              context,
            ),
          };
        },
      });
    } catch (error) {
      logError("[outfits/events]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerOutfitGetRoute(app, context) {
  const { getOutfitImpl, requireAuth } = context;

  app.get("/outfits/:id", requireAuth, async (req, res) => {
    try {
      const outfit = await getOutfitImpl(req.user.email, req.params.id);
      if (!outfit) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.json({
        ok: true,
        outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
      });
    } catch (error) {
      logError("[outfits/get]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerOutfitReadRoutes(app, context) {
  registerOutfitBootstrapRoute(app, context);
  registerOutfitRecentRoute(app, context);
  registerOutfitSearchRoute(app, context);
  registerOutfitEventRoute(app, context);
  registerOutfitGetRoute(app, context);
}

function registerOutfitRoutes(app, context) {
  registerOutfitReadRoutes(app, context);
  registerOutfitMutationRoutes(app, context);
}

export { registerOutfitRoutes };
