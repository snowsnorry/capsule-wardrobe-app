/* eslint-disable max-lines, max-lines-per-function, complexity */
import { randomUUID } from "node:crypto";
import { logError } from "../logger.js";
import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";
import type { CapsuleRecord } from "../capsuleStoreModel.js";
import { decodeLegacyBase64Image } from "../r2Storage.js";
import { normalizeWardrobeItemForPdf } from "../wardrobePdfItems.js";

const DEFAULT_OUTFIT_PAGE_LIMIT = 10;
const MAX_OUTFIT_PAGE_LIMIT = 50;

type OutfitImageSourceRequest =
  | null
  | { error: string }
  | { sourceCapsuleId: string; sourceSetIndex: number };
type CopiedImageResult =
  | { error: string }
  | { image: string | null; imageObsolete: boolean };
type CopyImageResult = { url?: string | null } | null | undefined;
type CopySourceOutfitImageContext = {
  copyImageObjectToR2Impl: (
    input: Record<string, unknown>,
  ) => Promise<CopyImageResult>;
  getCapsuleImpl: (
    email: string,
    capsuleId: string,
  ) => Promise<CapsuleRecord | null | undefined>;
  uploadImageToR2Impl: (
    input: Record<string, unknown>,
  ) => Promise<CopyImageResult>;
};

function isObjectPayload(body) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
}

function normalizeIntegerParam(value: unknown, fallback: number) {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(String(raw ?? ""), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizeOutfitImageSourceRequest(
  body = {},
): OutfitImageSourceRequest {
  const payload = body as Record<string, unknown>;
  const sourceCapsuleId = String(payload.sourceCapsuleId || "").trim();
  const hasSourceSetIndex = Object.prototype.hasOwnProperty.call(
    payload,
    "sourceSetIndex",
  );
  const sourceSetIndex = Number.parseInt(String(payload.sourceSetIndex), 10);
  if (!sourceCapsuleId && !hasSourceSetIndex) {
    return null;
  }
  if (
    !sourceCapsuleId ||
    !Number.isInteger(sourceSetIndex) ||
    sourceSetIndex < 0
  ) {
    return { error: "invalid_payload" };
  }
  return { sourceCapsuleId, sourceSetIndex };
}

function getTrimmedImage(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getSnapshotItemRefs(snapshot) {
  return Array.isArray(snapshot?.items) ? snapshot.items : [];
}

function areOutfitItemRefsEqual(left, right) {
  return (
    JSON.stringify(getSnapshotItemRefs(left)) ===
    JSON.stringify(getSnapshotItemRefs(right))
  );
}

function normalizeOutfitItemRef(item) {
  const url = String(item?.url || "").trim();
  if (!url) {
    return null;
  }
  return {
    url,
    source: item?.source === "uploaded" ? "uploaded" : "from_catalog",
  };
}

function getOutfitItemRefKeys(items) {
  return (Array.isArray(items) ? items : [])
    .map(normalizeOutfitItemRef)
    .filter(Boolean)
    .map((item) => `${item.source}\u0000${item.url}`)
    .sort();
}

function areOutfitItemRefKeysEqual(leftItems, rightItems) {
  const left = getOutfitItemRefKeys(leftItems);
  const right = getOutfitItemRefKeys(rightItems);
  return left.length > 0 && JSON.stringify(left) === JSON.stringify(right);
}

function getSourceOutfitSetItemRefs(effectiveSnapshot, outfitSet) {
  const wardrobeItems = effectiveSnapshot?.data?.wardrobe?.items;
  const itemsById = new Map(
    (Array.isArray(wardrobeItems) ? wardrobeItems : [])
      .map((item) => {
        const id = String(item?.id || "").trim();
        return id ? ([id, item] as const) : null;
      })
      .filter((entry): entry is readonly [string, unknown] => Boolean(entry)),
  );

  return (Array.isArray(outfitSet?.itemIds) ? outfitSet.itemIds : [])
    .map((itemId) => itemsById.get(String(itemId || "").trim()))
    .map(normalizeOutfitItemRef)
    .filter(Boolean);
}

async function copySourceOutfitImage({
  email,
  itemRefs,
  source,
  context,
}: {
  email: string;
  itemRefs: unknown[];
  source: { sourceCapsuleId: string; sourceSetIndex: number };
  context: CopySourceOutfitImageContext;
}): Promise<CopiedImageResult> {
  const capsule = await context.getCapsuleImpl(email, source.sourceCapsuleId);
  if (!capsule) {
    return { error: "not_found" };
  }

  const effectiveSnapshot = getEffectiveCapsuleSnapshot(capsule);
  const outfitSet =
    effectiveSnapshot?.data?.wardrobe?.outfitSets?.[source.sourceSetIndex];
  if (!outfitSet) {
    return { error: "not_found" };
  }

  const image = getTrimmedImage(outfitSet?.image);
  if (!image) {
    return { image: null, imageObsolete: false };
  }
  const sourceItemRefs = getSourceOutfitSetItemRefs(
    effectiveSnapshot,
    outfitSet,
  );
  const sourceItemsMatch = areOutfitItemRefKeysEqual(sourceItemRefs, itemRefs);

  const legacyBuffer = decodeLegacyBase64Image(image);
  const uploaded = legacyBuffer
    ? await context.uploadImageToR2Impl({
        buffer: legacyBuffer,
        mimeType: "image/png",
        capsuleId: `${source.sourceCapsuleId}-${randomUUID()}`,
        setIndex: source.sourceSetIndex,
        namespace: "copied",
      })
    : await context.copyImageObjectToR2Impl({
        sourceUrl: image,
        capsuleId: `${source.sourceCapsuleId}-${randomUUID()}`,
        setIndex: source.sourceSetIndex,
        namespace: "copied",
      });

  return {
    image: uploaded?.url || null,
    imageObsolete: Boolean(outfitSet?.imageObsolete) || !sourceItemsMatch,
  };
}

function buildUpdatedOutfitItemsSnapshot(outfit, items) {
  const effectiveSnapshot = contextlessEffectiveOutfitSnapshot(outfit);
  const nextSnapshot = {
    ...(effectiveSnapshot || { image: null, imageObsolete: false }),
    items,
  };
  const image = getTrimmedImage(effectiveSnapshot?.image);
  if (!image) {
    return { ...nextSnapshot, image: null, imageObsolete: false };
  }
  return {
    ...nextSnapshot,
    image,
    imageObsolete:
      Boolean(effectiveSnapshot?.imageObsolete) ||
      !areOutfitItemRefsEqual(effectiveSnapshot, nextSnapshot),
  };
}

function contextlessEffectiveOutfitSnapshot(outfit) {
  return outfit?.draft || outfit?.saved || null;
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

async function sendOutfitMutationResponse(req, res, outfit, context) {
  if (!outfit) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({
    ok: true,
    outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
  });
}

async function buildAnnotatedOutfitResponse(outfit, req, context) {
  const likedUrls = await context.listLikedItemUrlsImpl(req.user.email);
  const response = await context.toOutfitResponse(
    outfit,
    buildOutfitHydrationContext(req, context),
  );
  return annotateOutfitResponseItems(response, likedUrls, context);
}

function annotateOutfitResponseItems(response, likedUrls, context) {
  return {
    ...response,
    draft: annotateOutfitSnapshotItems(response.draft, likedUrls, context),
    saved: annotateOutfitSnapshotItems(response.saved, likedUrls, context),
    effective: annotateOutfitSnapshotItems(
      response.effective,
      likedUrls,
      context,
    ),
  };
}

function annotateOutfitSnapshotItems(snapshot, likedUrls, context) {
  if (!snapshot) {
    return snapshot;
  }

  return {
    ...snapshot,
    items: snapshot.items.map((entry) => ({
      ...entry,
      item: entry.item
        ? context.annotateLikedItems(entry.item, likedUrls)
        : entry.item,
    })),
  };
}

function buildOutfitHydrationContext(req, context) {
  return {
    email: req.user.email,
    getProductsByUrlsForEmailImpl: context.getProductsByUrlsForEmailImpl,
    listWardrobeItemsByUrlsImpl: context.listWardrobeItemsByUrlsImpl,
  };
}

export function registerOutfitRoutes(app, context) {
  registerOutfitReadRoutes(app, context);
  registerOutfitMutationRoutes(app, context);
}

function registerOutfitReadRoutes(app, context) {
  const {
    countOutfitsImpl,
    getOutfitImpl,
    listRecentOutfitsImpl,
    requireAuth,
    searchOutfitsImpl,
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

function registerOutfitMutationRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedOutfitCreateFields(req.body)
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const sourceRequest = normalizeOutfitImageSourceRequest(req.body);
        if (sourceRequest && "error" in sourceRequest) {
          return res.status(400).json({ error: sourceRequest.error });
        }
        const source =
          sourceRequest && !("error" in sourceRequest) ? sourceRequest : null;
        const copiedImage = source
          ? await copySourceOutfitImage({
              email: req.user.email,
              itemRefs: req.body?.items || [],
              source,
              context,
            })
          : null;
        if (copiedImage && "error" in copiedImage) {
          return res
            .status(copiedImage.error === "not_found" ? 404 : 400)
            .json({
              error: copiedImage.error,
            });
        }
        const copiedImageState =
          copiedImage && !("error" in copiedImage) ? copiedImage : null;
        const outfit = await context.createOutfitImpl(req.user.email, {
          name: String(req.body?.name || "").trim() || undefined,
          draft: {
            items: req.body?.items || [],
            ...(copiedImageState
              ? {
                  image: copiedImageState.image || null,
                  imageObsolete: Boolean(copiedImageState.imageObsolete),
                }
              : {}),
          },
          saved: null,
        });
        return res.status(201).json({
          ok: true,
          outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
        });
      } catch (error) {
        logError("[outfits/create]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.patch(
    "/outfits/:id/items",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      if (
        !isObjectPayload(req.body) ||
        context.hasUnexpectedOutfitItemsFields(req.body) ||
        !Object.prototype.hasOwnProperty.call(req.body, "items")
      ) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      try {
        const currentOutfit = await context.getOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!currentOutfit) {
          return res.status(404).json({ error: "not_found" });
        }
        const outfit = await context.updateOutfitSnapshotImpl(
          req.user.email,
          req.params.id,
          buildUpdatedOutfitItemsSnapshot(currentOutfit, req.body?.items || []),
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("[outfits/items]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  registerOutfitStateRoutes(app, context);
  registerOutfitMetadataRoutes(app, context);
  registerOutfitSelectionRoutes(app, context);
  registerOutfitImageRoutes(app, context);
  registerOutfitPdfRoute(app, context);
}

function registerOutfitImageRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.generateOutfitImageHandler,
  );

  app.delete(
    "/outfits/:id/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.deleteOutfitImageHandler,
  );
}

function registerOutfitStateRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/save",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.saveOutfitImpl(
          req.user.email,
          req.params.id,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("[outfits/save]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/outfits/:id/revert",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.revertOutfitImpl(
          req.user.email,
          req.params.id,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("[outfits/revert]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitMetadataRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.patch(
    "/outfits/:id/rename",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const name = String(req.body?.name || "").trim();
        if (!name) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const outfit = await context.renameOutfitImpl(
          req.user.email,
          req.params.id,
          name,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("[outfits/rename]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.post(
    "/outfits/:id/duplicate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.duplicateOutfitImpl(
          req.user.email,
          req.params.id,
          String(req.body?.name || "").trim() || undefined,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.status(201).json({
          ok: true,
          outfit: await buildAnnotatedOutfitResponse(outfit, req, context),
        });
      } catch (error) {
        logError("[outfits/duplicate]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitSelectionRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/select",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.getOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true, outfitId: outfit.id });
      } catch (error) {
        logError("[outfits/select]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/outfits/:id",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const deleted = await context.deleteOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!deleted) {
          return res.status(404).json({ error: "not_found" });
        }
        return res.json({ ok: true });
      } catch (error) {
        logError("[outfits/delete]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitPdfRoute(app, context) {
  app.post(
    "/outfits/:id/pdf",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.getOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }

        const items = await context.getOutfitItems(
          outfit,
          buildOutfitHydrationContext(req, context),
        );
        if (!Array.isArray(items) || items.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }

        const profile = await context.getProfileImpl(req.user.email);
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          items.map(normalizeWardrobeItemForPdf),
          String(profile?.locale || "en"),
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          context.buildPdfDownloadFilename(outfit?.name),
        );
        return res.status(200).send(pdfBuffer);
      } catch (error) {
        logError("[outfits/pdf]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}
