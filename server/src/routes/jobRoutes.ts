import { logError } from "../logger.js";

const JOB_EVENTS_POLL_INTERVAL_MS = 1000;
const JOB_EVENTS_MAX_DURATION_MS = 10 * 60 * 1000;
const JOB_EVENTS_MAX_STREAMS_PER_USER = 6;
const activeJobEventStreamsByEmail = new Map<string, number>();

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

function getActiveStreamCount(email: string) {
  return activeJobEventStreamsByEmail.get(email) || 0;
}

function incrementActiveStreamCount(email: string) {
  activeJobEventStreamsByEmail.set(email, getActiveStreamCount(email) + 1);
}

function decrementActiveStreamCount(email: string) {
  const nextCount = Math.max(0, getActiveStreamCount(email) - 1);
  if (nextCount === 0) {
    activeJobEventStreamsByEmail.delete(email);
    return;
  }
  activeJobEventStreamsByEmail.set(email, nextCount);
}

function normalizeStreamEmail(req) {
  return String(req.user.email || "")
    .trim()
    .toLowerCase();
}

function reserveJobEventStream(email: string, res) {
  if (getActiveStreamCount(email) >= JOB_EVENTS_MAX_STREAMS_PER_USER) {
    res.status(429).json({ error: "too_many_job_streams" });
    return false;
  }
  incrementActiveStreamCount(email);
  return true;
}

function getLastEventId(req) {
  return Number(req.headers["last-event-id"]) || 0;
}

function shouldCloseJobEventStream(latestStatus: unknown, startedAt: number) {
  return (
    isTerminalStatus(latestStatus) ||
    Date.now() - startedAt >= JOB_EVENTS_MAX_DURATION_MS
  );
}

function writeJobStreamEvents(res, events, lastEventId, latestStatus) {
  let nextLastEventId = lastEventId;
  let nextLatestStatus = latestStatus;
  for (const event of events) {
    nextLastEventId = Math.max(nextLastEventId, event.id);
    nextLatestStatus =
      String(
        (event.data?.job as { status?: unknown } | undefined)?.status || "",
      ) || nextLatestStatus;
    writeSseEvent(res, event.eventType, event.data, { id: event.id });
  }
  return { lastEventId: nextLastEventId, latestStatus: nextLatestStatus };
}

async function streamJobEvents(req, res, context) {
  const email = normalizeStreamEmail(req);
  if (!reserveJobEventStream(email, res)) {
    return undefined;
  }
  const initialJob = await context.getJobSnapshotImpl({
    id: req.params.jobId,
    email,
  });
  if (!initialJob) {
    decrementActiveStreamCount(email);
    return res.status(404).json({ error: "not_found" });
  }

  openJobEventStream(res);
  writeSseEvent(res, "snapshot", { job: initialJob });

  let lastEventId = getLastEventId(req);
  let latestStatus = initialJob.status;
  const startedAt = Date.now();

  try {
    while (isResponseWritable(res)) {
      const events = await context.listJobEventsAfterImpl({
        jobId: initialJob.id,
        afterId: lastEventId,
      });
      ({ lastEventId, latestStatus } = writeJobStreamEvents(
        res,
        events,
        lastEventId,
        latestStatus,
      ));

      if (shouldCloseJobEventStream(latestStatus, startedAt)) {
        break;
      }
      writeSseEvent(res, "heartbeat", { ok: true });
      await delay(JOB_EVENTS_POLL_INTERVAL_MS);
    }
  } finally {
    decrementActiveStreamCount(email);
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
