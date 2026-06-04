import type { ErrorWithCode } from "../ai/types.js";
import { logError } from "../logger.js";
import { buildWardrobeFilters } from "./wardrobeFilters.js";

export function registerCapsuleReadRoutes(app, context) {
  registerCapsuleBootstrapRoutes(app, context);
  registerCapsuleLookupRoutes(app, context);
  registerCapsuleShareRoutes(app, context);
  registerCapsuleActionRoutes(app, context);
}

function registerCapsuleBootstrapRoutes(app, context) {
  const {
    getProfileImpl,
    listRecentCapsulesImpl,
    requireAuth,
    searchCapsulesImpl,
    toCapsuleSummary,
    toProfileResponse,
  } = context;

  app.get("/capsules/bootstrap", requireAuth, async (req, res) => {
    try {
      const profile = await getProfileImpl(req.user.email);
      if (!profile) {
        return res.json({
          ok: true,
          hasProfile: false,
          profile: null,
          activeCapsule: null,
          activeSnapshot: null,
          capsules: [],
        });
      }
      const recentCapsules = await listRecentCapsulesImpl(req.user.email, 10);
      const wardrobeFilters = await buildWardrobeFilters(
        context,
        req.user.email,
      );
      return res.json({
        ok: true,
        hasProfile: true,
        profile: toProfileResponse(profile),
        activeCapsule: null,
        activeSnapshot: null,
        capsules: recentCapsules.map(toCapsuleSummary),
        wardrobeFilters,
      });
    } catch (error) {
      logError("[capsules/bootstrap]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/capsules/recent", requireAuth, async (req, res) => {
    try {
      const items = await listRecentCapsulesImpl(req.user.email, 10);
      return res.json({ ok: true, capsules: items.map(toCapsuleSummary) });
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

function registerCapsuleLookupRoutes(app, context) {
  const {
    getCapsuleEventSnapshot,
    getCapsuleImpl,
    listWardrobeItemsImpl,
    requireAuth,
    streamCapsuleEventsHandler,
    toCapsuleResponse,
    annotateWardrobeSavedItems,
  } = context;

  app.get("/capsules/:id", requireAuth, async (req, res) => {
    try {
      const capsule = await getCapsuleImpl(req.user.email, req.params.id);
      if (!capsule) {
        return res.status(404).json({ error: "not_found" });
      }
      const savedCatalogUrls = await listSavedCatalogUrls(
        listWardrobeItemsImpl,
        req.user.email,
      );
      return res.json({
        ok: true,
        capsule: annotateWardrobeSavedItems(
          toCapsuleResponse(capsule),
          savedCatalogUrls,
        ),
        snapshot: annotateWardrobeSavedItems(
          await getCapsuleEventSnapshot(req.user.email, capsule),
          savedCatalogUrls,
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

function registerCapsuleActionRoutes(app, context) {
  const {
    deleteOutfitSetImageHandler,
    generateOutfitSetImageHandler,
    regenerateCapsuleWardrobeHandler,
    regenerateSelectedCapsuleItemsHandler,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
  } = context;

  app.post(
    "/capsules/:id/regenerate",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    regenerateCapsuleWardrobeHandler,
  );

  app.post(
    "/capsules/:id/regenerate-selected",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    regenerateSelectedCapsuleItemsHandler,
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
