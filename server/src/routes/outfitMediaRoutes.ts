import { logError } from "../logger.js";
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

function isResponseWritable(res) {
  return !res.destroyed && !res.writableEnded;
}

function openOutfitReportEventStream(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function writeOutfitReportEvent(res, event, data) {
  if (!isResponseWritable(res)) {
    return false;
  }

  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function endOutfitReportEventStream(res) {
  if (isResponseWritable(res)) {
    res.end();
  }
}

function registerOutfitReportRoute(app, context) {
  const { requireTrustedOrigin, requireAuth, requireCsrf } = context;

  app.post(
    "/outfits/:id/report",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      openOutfitReportEventStream(res);
      writeOutfitReportEvent(res, "progress", { status: "pending" });

      try {
        const report = await context.generateOutfitReportImpl(
          req.user.email,
          req.params.id,
        );
        writeOutfitReportEvent(res, "complete", { ok: true, report });
      } catch (error) {
        const status = getOutfitReportErrorStatus(error);
        if (status === 503) {
          logError("[outfits/report]", error);
        }
        writeOutfitReportEvent(res, "fatal", {
          error: status === 503 ? "service_unavailable" : error.code,
        });
      } finally {
        endOutfitReportEventStream(res);
      }
      return undefined;
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
        logError("[outfits/report/delete]", error);
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

function registerOutfitMediaRoutes(app, context) {
  registerOutfitReportRoute(app, context);
  registerOutfitImageRoutes(app, context);
  registerOutfitPdfRoute(app, context);
}

export { registerOutfitMediaRoutes };
