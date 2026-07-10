import { logError } from "../logger.js";
import {
  recordRejectionMetric,
  setActiveJobEventStreamMetric,
} from "../observabilityMetrics.js";

const JOB_EVENTS_POLL_INTERVAL_MS = 1000;
const JOB_EVENTS_HEARTBEAT_INTERVAL_MS = 10_000;
const JOB_EVENTS_IDLE_GRACE_MS = 2000;
const JOB_EVENTS_PAGE_SIZE = 100;
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
  if (!isResponseWritable(res)) return false;
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

function getTotalActiveStreamCount() {
  let total = 0;
  for (const count of activeJobEventStreamsByEmail.values()) total += count;
  return total;
}

function incrementActiveStreamCount(email: string) {
  activeJobEventStreamsByEmail.set(email, getActiveStreamCount(email) + 1);
  setActiveJobEventStreamMetric(getTotalActiveStreamCount());
}

function decrementActiveStreamCount(email: string) {
  const nextCount = Math.max(0, getActiveStreamCount(email) - 1);
  if (nextCount === 0) {
    activeJobEventStreamsByEmail.delete(email);
  } else {
    activeJobEventStreamsByEmail.set(email, nextCount);
  }
  setActiveJobEventStreamMetric(getTotalActiveStreamCount());
}

function normalizeStreamEmail(req) {
  return String(req.user.email || "")
    .trim()
    .toLowerCase();
}

function reserveJobEventStream(email: string, res) {
  if (getActiveStreamCount(email) >= JOB_EVENTS_MAX_STREAMS_PER_USER) {
    recordRejectionMetric("active_cap:job_event_streams");
    res.status(429).json({ error: "too_many_job_streams" });
    return false;
  }
  incrementActiveStreamCount(email);
  return true;
}

function normalizeLastEventId(req, latestEventId: number) {
  const rawValue = Array.isArray(req.headers["last-event-id"])
    ? req.headers["last-event-id"][0]
    : req.headers["last-event-id"];
  const requested = Number(rawValue);
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return latestEventId;
  }
  return Math.min(requested, latestEventId);
}

function writeJobStreamEvents(res, events, lastEventId) {
  let nextLastEventId = lastEventId;
  for (const event of events) {
    nextLastEventId = Math.max(nextLastEventId, event.id);
    writeSseEvent(res, event.eventType, event.data, { id: event.id });
  }
  return nextLastEventId;
}

async function drainOwnedJobEvents({ context, email, lastEventId, res }) {
  let cursor = lastEventId;
  while (isResponseWritable(res)) {
    const events = await context.listJobEventsAfterImpl({
      email,
      afterId: cursor,
      limit: JOB_EVENTS_PAGE_SIZE,
    });
    cursor = writeJobStreamEvents(res, events, cursor);
    if (events.length < JOB_EVENTS_PAGE_SIZE) break;
  }
  return cursor;
}

async function streamJobEvents(req, res, context) {
  const email = normalizeStreamEmail(req);
  if (!reserveJobEventStream(email, res)) return undefined;

  try {
    const latestEventId = await context.getLatestJobEventIdImpl(email);
    let lastEventId = normalizeLastEventId(req, latestEventId);
    const initialJobs = await context.listJobSnapshotsImpl({
      email,
      status: "active",
    });

    openJobEventStream(res);
    writeSseEvent(
      res,
      "sync",
      { cursor: lastEventId, jobs: initialJobs },
      { id: lastEventId },
    );

    let idleSince: number | null = null;
    let lastHeartbeatAt = Date.now();
    while (isResponseWritable(res)) {
      lastEventId = await drainOwnedJobEvents({
        context,
        email,
        lastEventId,
        res,
      });
      const activeJobs = await context.listJobSnapshotsImpl({
        email,
        status: "active",
      });
      if (activeJobs.length > 0) {
        idleSince = null;
      } else {
        idleSince ??= Date.now();
        if (Date.now() - idleSince >= JOB_EVENTS_IDLE_GRACE_MS) break;
      }
      if (Date.now() - lastHeartbeatAt >= JOB_EVENTS_HEARTBEAT_INTERVAL_MS) {
        writeSseEvent(res, "heartbeat", { ok: true });
        lastHeartbeatAt = Date.now();
      }
      await delay(JOB_EVENTS_POLL_INTERVAL_MS);
    }
  } finally {
    decrementActiveStreamCount(email);
  }

  if (isResponseWritable(res)) res.end();
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

  app.get("/jobs/events", context.requireAuth, async (req, res) => {
    try {
      return await streamJobEvents(req, res, context);
    } catch (error) {
      logError("[jobs/events]", error);
      if (!res.headersSent) {
        return res.status(503).json({ error: "service_unavailable" });
      }
      if (isResponseWritable(res)) {
        writeSseEvent(res, "streamError", { error: "service_unavailable" });
        res.end();
      }
      return undefined;
    }
  });

  app.get("/jobs/:jobId", context.requireAuth, async (req, res) => {
    try {
      const job = await context.getJobSnapshotImpl({
        id: req.params.jobId,
        email: req.user.email,
      });
      if (!job) return res.status(404).json({ error: "not_found" });
      return res.json({ ok: true, job });
    } catch (error) {
      logError("[jobs/get]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}
