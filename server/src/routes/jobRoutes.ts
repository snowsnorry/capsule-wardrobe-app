import { logError } from "../logger.js";

const JOB_EVENTS_POLL_INTERVAL_MS = 1000;

function isResponseWritable(res) {
  return !res.destroyed && !res.writableEnded;
}

function writeSseEvent(
  res,
  event: string,
  data: unknown,
  options: { id?: number | string | null } = {},
) {
  if (!isResponseWritable(res)) {
    return false;
  }
  if (options.id !== undefined && options.id !== null) {
    res.write(`id: ${options.id}\n`);
  }
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data || {})}\n\n`);
  return true;
}

function openJobEventStream(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
}

function isTerminalStatus(status: unknown) {
  return status === "completed" || status === "failed";
}

function delay(ms: number) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer?.unref?.();
  });
}

function normalizeJobsStatus(value: unknown) {
  const status = String(Array.isArray(value) ? value[0] : value || "").trim();
  return ["active", "queued", "running", "completed", "failed"].includes(status)
    ? status
    : null;
}

async function streamJobEvents(req, res, context) {
  const initialJob = await context.getJobSnapshotImpl({
    id: req.params.jobId,
    email: req.user.email,
  });
  if (!initialJob) {
    return res.status(404).json({ error: "not_found" });
  }

  openJobEventStream(res);
  writeSseEvent(res, "snapshot", { job: initialJob });

  let lastEventId = Number(req.headers["last-event-id"]) || 0;
  let latestStatus = initialJob.status;

  while (isResponseWritable(res)) {
    const events = await context.listJobEventsAfterImpl({
      jobId: initialJob.id,
      afterId: lastEventId,
    });
    for (const event of events) {
      lastEventId = Math.max(lastEventId, event.id);
      latestStatus =
        String(
          (event.data?.job as { status?: unknown } | undefined)?.status || "",
        ) || latestStatus;
      writeSseEvent(res, event.eventType, event.data, { id: event.id });
    }

    if (isTerminalStatus(latestStatus)) {
      break;
    }
    writeSseEvent(res, "heartbeat", { ok: true });
    await delay(JOB_EVENTS_POLL_INTERVAL_MS);
  }

  if (isResponseWritable(res)) {
    res.end();
  }
  return undefined;
}

export function registerJobRoutes(app, context) {
  app.get("/jobs", context.requireAuth, async (req, res) => {
    try {
      const jobs = await context.listJobSnapshotsImpl({
        email: req.user.email,
        status: normalizeJobsStatus(req.query?.status),
      });
      return res.json({ ok: true, jobs });
    } catch (error) {
      logError("[jobs/list]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/jobs/:jobId", context.requireAuth, async (req, res) => {
    try {
      const job = await context.getJobSnapshotImpl({
        id: req.params.jobId,
        email: req.user.email,
      });
      if (!job) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.json({ ok: true, job });
    } catch (error) {
      logError("[jobs/get]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });

  app.get("/jobs/:jobId/events", context.requireAuth, async (req, res) => {
    try {
      return await streamJobEvents(req, res, context);
    } catch (error) {
      logError("[jobs/events]", error);
      if (!res.headersSent) {
        return res.status(503).json({ error: "service_unavailable" });
      }
      if (isResponseWritable(res)) {
        writeSseEvent(res, "failed", {
          error: "service_unavailable",
        });
        res.end();
      }
      return undefined;
    }
  });
}
