import { logError } from "../logger.js";

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

function isResponseWritable(res) {
  return !res.destroyed && !res.writableEnded;
}

function openPersonalItemsReportEventStream(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function writePersonalItemsReportEvent(res, event, data) {
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

function endPersonalItemsReportEventStream(res) {
  if (isResponseWritable(res)) {
    res.end();
  }
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
    async (req, res) => {
      openPersonalItemsReportEventStream(res);
      writePersonalItemsReportEvent(res, "progress", { status: "pending" });

      try {
        const requestContext = getRequestContext(req.body);
        if (!requestContext.ok) {
          writePersonalItemsReportEvent(res, "fatal", {
            error: "invalid_payload",
          });
          return undefined;
        }

        const result = await context.generatePersonalItemsReportImpl(
          req.user.email,
          requestContext.context,
        );
        writePersonalItemsReportEvent(res, "complete", {
          ok: true,
          ...result,
        });
      } catch (error) {
        const status = getPersonalItemsReportErrorStatus(error);
        if (status === 503) {
          logError("[wardrobe/items/report][generate]", error);
        }
        writePersonalItemsReportEvent(res, "fatal", {
          error: status === 503 ? "service_unavailable" : error.code,
        });
      } finally {
        endPersonalItemsReportEventStream(res);
      }
      return undefined;
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
  normalizeUrlSet,
  registerPersonalItemsReportRoutes,
};
