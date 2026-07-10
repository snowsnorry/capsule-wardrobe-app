import type { ErrorWithCode } from "../ai/types.js";
import { logError } from "../logger.js";
import { hashCapsuleContent } from "../db.js";
import {
  enqueueRouteJob,
  sendJobEnqueueError,
  sendQueuedJob,
} from "./jobRouteResponses.js";
import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";
import {
  getOutfitSetsFromSnapshot,
  resolveTargetSetItems,
} from "../ai/outfitSetImageSnapshots.js";

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

function buildCapsuleGenerateDedupeKey(capsuleId, capsule) {
  return `capsuleGenerate:${capsuleId}:${hashCapsuleContent(
    getEffectiveCapsuleSnapshot(capsule),
  )}`;
}

function buildSelectedRegenerationDedupeKey(capsuleId, capsule, itemUrls) {
  return `capsuleRegenerateSelected:${capsuleId}:${hashCapsuleContent({
    itemUrls,
    snapshot: getEffectiveCapsuleSnapshot(capsule),
  })}`;
}

function buildOutfitSetImageDedupeKey(capsuleId, setIndex, setItems) {
  return `outfitSetImage:${capsuleId}:${setIndex}:${hashCapsuleContent(
    setItems.map((item) => ({
      id: item?.id ?? null,
      source: item?.source ?? null,
      url: item?.url ?? null,
      imageUrl: item?.imageUrl ?? item?.image_url ?? null,
    })),
  )}`;
}

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

function getOutfitSetImageRouteInput(req) {
  const capsuleId = String(req.params.id || "").trim();
  const setIndex = Number.parseInt(String(req.params.setIndex ?? ""), 10);
  return { capsuleId, setIndex };
}

async function sendQueuedOutfitSetImageJob(context, req, res) {
  const { capsuleId, setIndex } = getOutfitSetImageRouteInput(req);
  if (!capsuleId || !Number.isInteger(setIndex) || setIndex < 0) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const capsule = await context.getCapsuleImpl(req.user.email, capsuleId);
  if (!capsule) {
    return res.status(404).json({ error: "not_found" });
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const { wardrobe, outfitSets } = getOutfitSetsFromSnapshot(effectiveSnapshot);
  const targetSet = outfitSets[setIndex];
  if (!targetSet) {
    return res.status(404).json({ error: "not_found" });
  }
  if (typeof targetSet?.image === "string" && targetSet.image.trim()) {
    return res.json({ ok: true, status: "ready" });
  }

  const setItems = resolveTargetSetItems(wardrobe, setIndex);
  if (!Array.isArray(setItems) || setItems.length < 3) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const job = await enqueueRouteJob(context, {
    kind: "outfitSetImageGenerate",
    profileEmail: req.user.email,
    entity: { type: "capsule", id: capsuleId },
    dedupeKey: buildOutfitSetImageDedupeKey(capsuleId, setIndex, setItems),
    phase: "queued",
    payload: { capsuleId, setIndex },
    progressLabel: "Generating outfit set image",
  });
  return sendQueuedJob(res, job);
}

// eslint-disable-next-line max-lines-per-function
function registerCapsuleActionRoutes(app, context) {
  const {
    deleteOutfitSetImageHandler,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
  } = context;

  app.post(
    "/capsules/:id/regenerate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.jobEnqueueLimiter,
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
          dedupeKey: buildCapsuleGenerateDedupeKey(req.params.id, capsule),
          phase: "queued",
          payload: { capsuleId: req.params.id },
          progressLabel: "Building capsule",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
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
    context.jobEnqueueLimiter,
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
          dedupeKey: buildSelectedRegenerationDedupeKey(
            req.params.id,
            capsule,
            itemUrls,
          ),
          phase: "queued",
          payload: { capsuleId: req.params.id, itemUrls },
          progressLabel: "Regenerating selected items",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
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
    context.jobEnqueueLimiter,
    async (req, res) => {
      try {
        return await sendQueuedOutfitSetImageJob(context, req, res);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
        logError("[capsules/outfit-set-image][enqueue]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/capsules/:id/outfit-sets/:setIndex/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    deleteOutfitSetImageHandler,
  );
}
