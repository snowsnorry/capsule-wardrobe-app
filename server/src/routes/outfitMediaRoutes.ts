import { logError } from "../logger.js";
import {
  enqueueRouteJob,
  sendJobEnqueueError,
  sendQueuedJob,
} from "./jobRouteResponses.js";
import { hashCapsuleContent } from "../db.js";
import { getEffectiveOutfitSnapshot } from "../outfitStore.js";
import { normalizeWardrobeItemForPdf } from "../wardrobePdfItems.js";
import {
  buildOutfitHydrationContext,
  sendOutfitMutationResponse,
} from "./outfitRouteResponses.js";

function getOutfitReportErrorStatus(error) {
  switch (error?.code) {
    case "invalid_payload":
      return 400;
    case "not_found":
      return 404;
    default:
      return 503;
  }
}

function buildOutfitImageDedupeKey(outfitId, items) {
  return `outfitImage:${outfitId}:${hashCapsuleContent(
    items.map((item) => ({
      id: item?.id ?? null,
      source: item?.source ?? null,
      url: item?.url ?? null,
      imageUrl: item?.imageUrl ?? item?.image_url ?? null,
    })),
  )}`;
}

function registerOutfitReportRoute(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/report",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.jobEnqueueLimiter,
    async (req, res) => {
      try {
        const outfit = await context.getOutfitImpl(
          req.user.email,
          req.params.id,
        );
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        const job = await enqueueRouteJob(context, {
          kind: "outfitReportGenerate",
          profileEmail: req.user.email,
          entity: { type: "outfit", id: String(req.params.id || "") },
          dedupeKey: `outfitReport:${req.params.id}`,
          phase: "queued",
          payload: { outfitId: req.params.id },
          progressLabel: "Generating outfit report",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
        const status = getOutfitReportErrorStatus(error);
        if (status === 503) {
          logError("outfit.report.generate.failed", error);
        }
        return res
          .status(status)
          .json({ error: status === 503 ? "service_unavailable" : error.code });
      }
    },
  );

  app.delete(
    "/outfits/:id/report",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      try {
        const outfit = await context.updateOutfitReportImpl(
          req.user.email,
          req.params.id,
          null,
        );
        return sendOutfitMutationResponse(req, res, outfit, context);
      } catch (error) {
        logError("outfit.report.delete.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerOutfitImageRoutes(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.jobEnqueueLimiter,
    async (req, res) => {
      try {
        const outfitId = String(req.params.id || "").trim();
        if (!outfitId) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const outfit = await context.getOutfitImpl(req.user.email, outfitId);
        if (!outfit) {
          return res.status(404).json({ error: "not_found" });
        }
        const effectiveSnapshot = getEffectiveOutfitSnapshot(outfit);
        if (
          typeof effectiveSnapshot?.image === "string" &&
          effectiveSnapshot.image.trim().length > 0
        ) {
          return res.json({ ok: true, status: "ready" });
        }
        const items = await context.getOutfitItems(
          outfit,
          buildOutfitHydrationContext(req, context),
        );
        if (!Array.isArray(items) || items.length < 3) {
          return res.status(400).json({ error: "invalid_payload" });
        }
        const job = await enqueueRouteJob(context, {
          kind: "outfitImageGenerate",
          profileEmail: req.user.email,
          entity: { type: "outfit", id: outfitId },
          dedupeKey: buildOutfitImageDedupeKey(outfitId, items),
          phase: "queued",
          payload: { outfitId },
          progressLabel: "Generating outfit image",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
        logError("outfit.image.enqueue.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );

  app.delete(
    "/outfits/:id/image",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    context.deleteOutfitImageHandler,
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

        const effectiveSnapshot = getEffectiveOutfitSnapshot(outfit);
        const profile = await context.getProfileImpl(req.user.email);
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          items.map(normalizeWardrobeItemForPdf),
          String(profile?.locale || "en"),
          {
            outfit: buildOutfitPdfOptions(outfit, effectiveSnapshot),
          },
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          context.buildPdfDownloadFilename(outfit?.name),
        );
        return res.status(200).send(pdfBuffer);
      } catch (error) {
        logError("outfit.pdf.generate.failed", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function getReportItemsHash(report) {
  return report && typeof report === "object" && !Array.isArray(report)
    ? String(report.itemsHash || "").trim()
    : "";
}

function isReportStale(snapshot) {
  const reportItemsHash = getReportItemsHash(snapshot?.report);
  return Boolean(
    reportItemsHash &&
    reportItemsHash !==
      hashCapsuleContent(Array.isArray(snapshot?.items) ? snapshot.items : []),
  );
}

function buildOutfitPdfOptions(outfit, effectiveSnapshot) {
  return {
    title: String(outfit?.name || "").trim(),
    imageUrl: effectiveSnapshot?.image || null,
    imageStale: Boolean(effectiveSnapshot?.imageObsolete),
    report: effectiveSnapshot?.report || null,
    reportStale: isReportStale(effectiveSnapshot),
  };
}

function registerOutfitMediaRoutes(app, context) {
  registerOutfitReportRoute(app, context);
  registerOutfitImageRoutes(app, context);
  registerOutfitPdfRoute(app, context);
}

export { registerOutfitMediaRoutes };
