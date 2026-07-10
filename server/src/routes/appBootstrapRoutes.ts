import { logError } from "../logger.js";
import {
  buildCapsulePaginationResponse,
  normalizeCapsulePaginationRequest,
} from "./capsuleReadRoutes.js";
import {
  buildOutfitPaginationResponse,
  normalizeOutfitPaginationRequest,
} from "./outfitRoutes.js";
import { buildWardrobeFilters } from "./wardrobeFilters.js";

async function resolveOptional<T>(operation: () => Promise<T>, fallback: T) {
  try {
    return await operation();
  } catch {
    return fallback;
  }
}

async function buildProfileBootstrapPayload(context, email: string) {
  const capsulePaginationRequest = normalizeCapsulePaginationRequest();
  const outfitPaginationRequest = normalizeOutfitPaginationRequest();
  const [recentCapsules, capsuleTotal, wardrobeFilters] = await Promise.all([
    context.listRecentCapsulesImpl(
      email,
      capsulePaginationRequest.limit,
      capsulePaginationRequest.offset,
    ),
    context.countCapsulesImpl(email),
    buildWardrobeFilters(context, email),
  ]);
  const [recentOutfits, outfitTotal, wardrobeCount] = await Promise.all([
    resolveOptional(
      () =>
        context.listRecentOutfitsImpl(
          email,
          outfitPaginationRequest.limit,
          outfitPaginationRequest.offset,
        ),
      [],
    ),
    resolveOptional(() => context.countOutfitsImpl(email), 0),
    resolveOptional(
      () => context.countWardrobeItemsImpl({ email, source: null }),
      null,
    ),
  ]);

  return {
    activeCapsule: null,
    activeSnapshot: null,
    capsules: recentCapsules.map(context.toCapsuleSummary),
    capsulePagination: buildCapsulePaginationResponse(
      capsulePaginationRequest,
      capsuleTotal,
    ),
    outfits: recentOutfits.map(context.toOutfitSummary),
    outfitPagination: buildOutfitPaginationResponse(
      outfitPaginationRequest,
      outfitTotal,
    ),
    wardrobeCount,
    wardrobeFilters,
  };
}

function registerAppBootstrapRoutes(app, context) {
  app.get("/app/bootstrap", context.requireAuth, async (req, res) => {
    try {
      const profile = await context.getProfileImpl(req.user.email);
      if (!profile) {
        return res.json({
          ok: true,
          hasProfile: false,
          profile: null,
          activeCapsule: null,
          activeSnapshot: null,
          capsules: [],
          capsulePagination: null,
          outfits: [],
          outfitPagination: null,
          wardrobeFilters: null,
          wardrobeCount: 0,
        });
      }

      const profilePayload = await buildProfileBootstrapPayload(
        context,
        req.user.email,
      );
      return res.json({
        ok: true,
        hasProfile: true,
        profile: context.toProfileResponse(profile),
        ...profilePayload,
      });
    } catch (error) {
      logError("app.bootstrap.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

export { registerAppBootstrapRoutes };
