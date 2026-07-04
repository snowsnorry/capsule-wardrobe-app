import type { ErrorWithCode } from "../ai/types.js";
import { logError } from "../logger.js";
import { enqueueRouteJob, sendQueuedJob } from "./jobRouteResponses.js";

export function registerCapsuleReadRoutes(app, context) {
  registerCapsuleListRoutes(app, context);
  registerCapsuleLookupRoutes(app, context);
  registerCapsuleShareRoutes(app, context);
  registerCapsuleActionRoutes(app, context);
}

function registerCapsuleListRoutes(app, context) {
  const {
    countCapsulesImpl,
    listRecentCapsulesImpl,
    requireAuth,
    searchCapsulesImpl,
    toCapsuleSummary,
  } = context;

  app.get("/capsules/recent", requireAuth, async (req, res) => {
    try {
      const paginationRequest = normalizeCapsulePaginationRequest(req.query);
      const items = await listRecentCapsulesImpl(
        req.user.email,
        paginationRequest.limit,
        paginationRequest.offset,
      );
      const total = await countCapsulesImpl(req.user.email);
      return res.json({
        ok: true,
        capsules: items.map(toCapsuleSummary),
        pagination: buildCapsulePaginationResponse(paginationRequest, total),
      });
    } catch (error) {
      logError("[capsules/recent]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/capsules/search", requireAuth, async (req, res) => {
    try {
      const query = String(req.query?.q || "").trim();
      const items = query
        ? await searchCapsulesImpl(req.user.email, query, 25)
        : await listRecentCapsulesImpl(req.user.email, 25);
      return res.json({ ok: true, capsules: items.map(toCapsuleSummary) });
    } catch (error) {
      logError("[capsules/search]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

const DEFAULT_CAPSULE_PAGE_LIMIT = 10;
const MAX_CAPSULE_PAGE_LIMIT = 50;

function normalizeIntegerParam(value: unknown, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function normalizeCapsulePaginationRequest(
  query: Record<string, unknown> = {},
) {
  const limit = Math.min(
    MAX_CAPSULE_PAGE_LIMIT,
    Math.max(1, normalizeIntegerParam(query.limit, DEFAULT_CAPSULE_PAGE_LIMIT)),
  );
  const offset = normalizeIntegerParam(query.offset, 0);
  return { limit, offset };
}

export function buildCapsulePaginationResponse(
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

function registerCapsuleLookupRoutes(app, context) {
  const {
    getCapsuleEventSnapshot,
    getCapsuleImpl,
    listWardrobeItemsImpl,
    listLikedItemUrlsImpl,
    requireAuth,
    streamCapsuleEventsHandler,
    toCapsuleResponse,
    annotateWardrobeSavedItems,
    annotateLikedItems,
  } = context;

  app.get("/capsules/:id", requireAuth, async (req, res) => {
    if (req.params.id === "bootstrap") {
      return res.status(404).json({ error: "not_found" });
    }

    try {
      const capsule = await getCapsuleImpl(req.user.email, req.params.id);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }
      const savedCatalogUrls = await listSavedCatalogUrls(
        listWardrobeItemsImpl,
        req.user.email,
      );
      const likedUrls = await listLikedItemUrlsImpl(req.user.email);
      return res.json({
        ok: true,
        capsule: annotateLikedItems(
          annotateWardrobeSavedItems(
            toCapsuleResponse(capsule),
            savedCatalogUrls,
          ),
          likedUrls,
        ),
        snapshot: annotateLikedItems(
          annotateWardrobeSavedItems(
            await getCapsuleEventSnapshot(req.user.email, capsule),
            savedCatalogUrls,
          ),
          likedUrls,
        ),
      });
    } catch (error) {
      logError("[capsules/get]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/capsules/:id/events", requireAuth, streamCapsuleEventsHandler);
}

async function listSavedCatalogUrls(listWardrobeItemsImpl, email: string) {
  const items = await listWardrobeItemsImpl({
    email,
    source: "from_catalog",
  });

  return Array.isArray(items)
    ? items.map((item) => String(item?.url || "").trim()).filter(Boolean)
    : [];
}

function registerCapsuleShareRoutes(app, context) {
  const {
    clientOrigin,
    createCapsuleShareImpl,
    getSharedCapsuleImpl,
    importSharedCapsuleImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    toCapsuleResponse,
  } = context;

  app.post(
    "/capsules/:id/share",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const share = await createCapsuleShareImpl(
          req.user.email,
          req.params.id,
          clientOrigin,
        );
        if (!share) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.status(201).json({ ok: true, ...share });
      } catch (error) {
        const errorResponse = sendCapsuleShareErrorResponse(res, error);
        if (errorResponse) {
          return errorResponse;
        }
        logError("[capsules/share]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.get("/shared-capsules/:id", async (req, res) => {
    try {
      const shared = await getSharedCapsuleImpl(req.params.id);
      if (!shared) {
        return res.status(404).json({ error: "shared_capsule_unavailable" });
      }
      return res.json({ ok: true, ...shared });
    } catch (error) {
      logError("[shared-capsules/get]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.post(
    "/shared-capsules/:id/import",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await importSharedCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "shared_capsule_unavailable" });
        }
        return res.status(201).json({
          ok: true,
          capsule: toCapsuleResponse(capsule),
          capsuleId: capsule.id,
          name: capsule.name,
        });
      } catch (error) {
        const errorResponse = sendCapsuleShareErrorResponse(res, error);
        if (errorResponse) {
          return errorResponse;
        }
        logError("[shared-capsules/import]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function sendCapsuleShareErrorResponse(res, error) {
  const code = (error as ErrorWithCode)?.code || (error as Error)?.message;
  if (code === "capsule_contains_personal_items") {
    return res.status(400).json({ error: "capsule_contains_personal_items" });
  }
  if (code === "capsule_not_shareable") {
    return res.status(400).json({ error: "capsule_not_shareable" });
  }
  return null;
}

// eslint-disable-next-line max-lines-per-function
function registerCapsuleActionRoutes(app, context) {
  const {
    deleteOutfitSetImageHandler,
    generateOutfitSetImageHandler,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
  } = context;

  app.post(
    "/capsules/:id/regenerate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.getCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        const job = await enqueueRouteJob(context, {
          kind: "capsuleGenerate",
          profileEmail: req.user.email,
          entity: { type: "capsule", id: String(req.params.id || "") },
          dedupeKey: `capsuleGenerate:${req.params.id}`,
          phase: "queued",
          payload: { capsuleId: req.params.id },
          progressLabel: "Building capsule",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        logError("[capsules/regenerate][enqueue]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/capsules/:id/regenerate-selected",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      const itemUrls = Array.isArray(req.body?.itemUrls)
        ? req.body.itemUrls
            .map((itemUrl) => String(itemUrl || "").trim())
            .filter(Boolean)
        : [];
      if (itemUrls.length === 0) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const capsule = await context.getCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        const job = await enqueueRouteJob(context, {
          kind: "capsuleRegenerateSelected",
          profileEmail: req.user.email,
          entity: { type: "capsule", id: String(req.params.id || "") },
          dedupeKey: `capsuleRegenerateSelected:${req.params.id}:${itemUrls.join("|")}`,
          phase: "queued",
          payload: { capsuleId: req.params.id, itemUrls },
          progressLabel: "Regenerating selected items",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        logError("[capsules/regenerate-selected][enqueue]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/capsules/:id/outfit-sets/:setIndex/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    generateOutfitSetImageHandler,
  );

  app.delete(
    "/capsules/:id/outfit-sets/:setIndex/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    deleteOutfitSetImageHandler,
  );
}
