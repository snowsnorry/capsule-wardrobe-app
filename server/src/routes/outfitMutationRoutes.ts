/* eslint-disable max-lines-per-function, complexity */
import { randomUUID } from "node:crypto";
import { getEffectiveCapsuleSnapshot } from "../capsuleStore.js";
import type { CapsuleRecord } from "../capsuleStoreModel.js";
import { logError } from "../logger.js";
import { registerOutfitLifecycleRoutes } from "./outfitLifecycleRoutes.js";
import { registerOutfitMediaRoutes } from "./outfitMediaRoutes.js";
import {
  buildAnnotatedOutfitResponse,
  sendOutfitMutationResponse,
} from "./outfitRouteResponses.js";

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
};

function isObjectPayload(body) {
  return Boolean(body) && typeof body === "object" && !Array.isArray(body);
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

  const uploaded = await context.copyImageObjectToR2Impl({
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

function contextlessEffectiveOutfitSnapshot(outfit) {
  return outfit?.draft || outfit?.saved || null;
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

  registerOutfitLifecycleRoutes(app, context);
  registerOutfitMediaRoutes(app, context);
}

export { registerOutfitMutationRoutes };
