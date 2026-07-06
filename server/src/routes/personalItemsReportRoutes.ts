import { createHash } from "node:crypto";

import { logError } from "../logger.js";
import {
  enqueueRouteJob,
  sendJobEnqueueError,
  sendQueuedJob,
} from "./jobRouteResponses.js";

function getPersonalItemsReportErrorStatus(error) {
  switch (error?.code) {
    case "invalid_payload":
      return 400;
    case "not_found":
      return 404;
    default:
      return 503;
  }
}

function normalizeUrlSet(items: Array<Record<string, unknown>>) {
  return [
    ...new Set(
      items
        .map((item) => String(item?.url || "").trim())
        .filter((url) => url.length > 0),
    ),
  ].sort((left, right) => left.localeCompare(right));
}

function areEqualStringSets(left: string[] = [], right: string[] = []) {
  if (left.length !== right.length) {
    return false;
  }
  return left.every((value, index) => value === right[index]);
}

function getRequestContext(body) {
  if (body?.context === undefined || body?.context === null) {
    return { ok: true, context: null };
  }
  if (typeof body.context !== "string") {
    return { ok: false };
  }
  return { ok: true, context: body.context };
}

function buildPersonalItemsReportDedupeKey(context?: string | null) {
  const normalizedContext = String(context || "").trim();
  const digest = createHash("sha256").update(normalizedContext).digest("hex");
  return `personalItemsReport:v1:${digest}`;
}

function registerPersonalItemsReportRoutes(app, context) {
  app.get("/wardrobe/items/report", context.requireAuth, async (req, res) => {
    try {
      const [storedReport, items] = await Promise.all([
        context.getPersonalItemsReportImpl(req.user.email),
        context.listWardrobeItemsImpl({
          email: req.user.email,
          source: null,
        }),
      ]);
      const currentUrls = normalizeUrlSet(Array.isArray(items) ? items : []);
      const storedUrls = Array.isArray(storedReport?.personalItemUrls)
        ? [...storedReport.personalItemUrls].sort((left, right) =>
            left.localeCompare(right),
          )
        : [];

      return res.json({
        ok: true,
        report: storedReport?.report || null,
        personalItemUrls: storedReport ? storedUrls : currentUrls,
        generatedAt: storedReport?.generatedAt || null,
        stale: storedReport
          ? !areEqualStringSets(storedUrls, currentUrls)
          : false,
      });
    } catch (error) {
      logError("[wardrobe/items/report]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.post(
    "/wardrobe/items/report",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    context.jobEnqueueLimiter,
    async (req, res) => {
      try {
        const requestContext = getRequestContext(req.body);
        if (!requestContext.ok) {
          return res.status(400).json({ error: "invalid_payload" });
        }

        const job = await enqueueRouteJob(context, {
          kind: "personalItemsReportGenerate",
          profileEmail: req.user.email,
          entity: { type: "wardrobe", id: null },
          dedupeKey: buildPersonalItemsReportDedupeKey(requestContext.context),
          phase: "queued",
          payload: { context: requestContext.context },
          progressLabel: "Analyzing Personal items",
        });
        return sendQueuedJob(res, job);
      } catch (error) {
        const jobError = sendJobEnqueueError(res, error);
        if (jobError) {
          return jobError;
        }
        const status = getPersonalItemsReportErrorStatus(error);
        if (status === 503) {
          logError("[wardrobe/items/report][generate]", error);
        }
        return res
          .status(status)
          .json({ error: status === 503 ? "service_unavailable" : error.code });
      }
    },
  );

  app.delete(
    "/wardrobe/items/report",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      try {
        const removed = await context.deletePersonalItemsReportImpl(
          req.user.email,
        );
        return res.json({ ok: true, removed });
      } catch (error) {
        logError("[wardrobe/items/report][delete]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

export {
  areEqualStringSets,
  buildPersonalItemsReportDedupeKey,
  normalizeUrlSet,
  registerPersonalItemsReportRoutes,
};
