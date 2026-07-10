import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addJobSnapshotListener,
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  subscribeUserJobEvents,
  waitForJob,
  type JobSnapshot,
} from "../api/jobs";

const DISCOVERY_INTERVAL_MS = 30_000;

type JobWaiter = {
  reject: (error: unknown) => void;
  resolve: (job: JobSnapshot) => void;
};

type JobTrackerState = {
  activeJobEntityKeys: string[];
  jobs: JobSnapshot[];
  waitForJobCompletion: (jobId: string) => Promise<JobSnapshot>;
};

function isTerminalJob(job: JobSnapshot) {
  return job.status === "completed" || job.status === "failed";
}

function isVisibleDocument() {
  return document.visibilityState === "visible";
}

function isNewerSnapshot(current: JobSnapshot | undefined, next: JobSnapshot) {
  if (!current) return true;
  const currentTime = Date.parse(current.updatedAt);
  const nextTime = Date.parse(next.updatedAt);
  if (Number.isFinite(currentTime) && Number.isFinite(nextTime)) {
    if (nextTime > currentTime) return true;
    if (nextTime < currentTime) return false;
  }
  return !(isTerminalJob(current) && !isTerminalJob(next));
}

function mergeActiveSnapshot(current: JobSnapshot[], next: JobSnapshot) {
  const withoutCurrent = current.filter((job) => job.id !== next.id);
  return isTerminalJob(next) ? withoutCurrent : [...withoutCurrent, next];
}

function resolveWaiters(waiters: Map<string, JobWaiter[]>, job: JobSnapshot) {
  if (!isTerminalJob(job)) return;
  const matching = waiters.get(job.id);
  if (!matching) return;
  waiters.delete(job.id);
  for (const waiter of matching) waiter.resolve(job);
}

function rejectAllWaiters(waiters: Map<string, JobWaiter[]>, error: unknown) {
  for (const matching of waiters.values()) {
    for (const waiter of matching) waiter.reject(error);
  }
  waiters.clear();
}

// eslint-disable-next-line max-lines-per-function
export function useJobTracker(userEmail: string): JobTrackerState {
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const [streamVersion, setStreamVersion] = useState(0);
  const jobsRef = useRef<JobSnapshot[]>([]);
  const snapshotsRef = useRef(new Map<string, JobSnapshot>());
  const waitersRef = useRef(new Map<string, JobWaiter[]>());
  const streamControllerRef = useRef<AbortController | null>(null);
  const eventCursorRef = useRef(0);
  const identityRef = useRef(userEmail);
  const pollingControllersRef = useRef(new Set<AbortController>());

  const setActiveJobs = useCallback(
    (update: (current: JobSnapshot[]) => JobSnapshot[]) => {
      setJobs((current) => {
        const next = update(current);
        jobsRef.current = next;
        return next;
      });
    },
    [],
  );

  const applyJobSnapshot = useCallback(
    (job: JobSnapshot) => {
      const current = snapshotsRef.current.get(job.id);
      if (!isNewerSnapshot(current, job)) return;
      snapshotsRef.current.set(job.id, job);
      resolveWaiters(waitersRef.current, job);
      setActiveJobs((activeJobs) => mergeActiveSnapshot(activeJobs, job));
    },
    [setActiveJobs],
  );

  const removeJobSnapshot = useCallback(
    (jobId: string) => {
      snapshotsRef.current.delete(jobId);
      setActiveJobs((activeJobs) =>
        activeJobs.filter((job) => job.id !== jobId),
      );
    },
    [setActiveJobs],
  );

  useEffect(() => {
    if (!userEmail) return undefined;
    return addJobSnapshotListener(applyJobSnapshot);
  }, [applyJobSnapshot, userEmail]);

  useEffect(() => {
    if (identityRef.current === userEmail) return;
    identityRef.current = userEmail;
    streamControllerRef.current?.abort();
    streamControllerRef.current = null;
    eventCursorRef.current = 0;
    for (const controller of pollingControllersRef.current) controller.abort();
    pollingControllersRef.current.clear();
    snapshotsRef.current.clear();
    setActiveJobs(() => []);
    rejectAllWaiters(waitersRef.current, new Error("job_wait_aborted"));
  }, [setActiveJobs, userEmail]);

  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    const schedule = () => {
      if (!active || !userEmail || !isVisibleDocument()) return;
      timer = window.setTimeout(load, DISCOVERY_INTERVAL_MS);
    };

    const reconcileMissingJob = async (jobId: string) => {
      try {
        const { job } = await fetchJob(jobId);
        if (active) applyJobSnapshot(job);
      } catch (error) {
        if ((error as { status?: unknown } | null)?.status === 404) {
          removeJobSnapshot(jobId);
        }
        // A later discovery can restore other transiently unavailable jobs.
      }
    };

    const load = async () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (!active || !userEmail || !isVisibleDocument()) return;
      try {
        const response = await fetchActiveJobs({ force: true });
        const activeIds = new Set(response.jobs.map((job) => job.id));
        for (const job of response.jobs) applyJobSnapshot(job);
        for (const job of jobsRef.current) {
          if (!activeIds.has(job.id)) void reconcileMissingJob(job.id);
        }
      } catch {
        // Keep the last known state across transient discovery failures.
      } finally {
        schedule();
      }
    };

    const onVisibilityChange = () => {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
      if (isVisibleDocument()) void load();
    };

    void load();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [applyJobSnapshot, removeJobSnapshot, userEmail]);

  const hasActiveJobs = jobs.length > 0;
  useEffect(() => {
    if (!userEmail || !hasActiveJobs) {
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
      return undefined;
    }
    if (streamControllerRef.current) return undefined;

    const controller = new AbortController();
    streamControllerRef.current = controller;
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled || controller.signal.aborted) return;
      void subscribeUserJobEvents({
        lastEventId: eventCursorRef.current,
        signal: controller.signal,
        onCursor(cursor) {
          eventCursorRef.current = Math.max(eventCursorRef.current, cursor);
        },
        onJob: applyJobSnapshot,
        onSync(syncJobs) {
          const syncIds = new Set(syncJobs.map((job) => job.id));
          for (const job of syncJobs) applyJobSnapshot(job);
          for (const job of jobsRef.current) {
            if (syncIds.has(job.id)) continue;
            void fetchJob(job.id).then(
              ({ job: reconciled }) => applyJobSnapshot(reconciled),
              () => undefined,
            );
          }
        },
      })
        .catch(() => undefined)
        .finally(() => {
          if (streamControllerRef.current !== controller) return;
          streamControllerRef.current = null;
          if (!controller.signal.aborted && jobsRef.current.length > 0) {
            setStreamVersion((current) => current + 1);
          }
        });
    });

    return () => {
      cancelled = true;
      controller.abort();
      if (streamControllerRef.current === controller) {
        streamControllerRef.current = null;
      }
    };
  }, [applyJobSnapshot, hasActiveJobs, streamVersion, userEmail]);

  useEffect(
    () => () => {
      streamControllerRef.current?.abort();
      streamControllerRef.current = null;
      for (const controller of pollingControllersRef.current) {
        controller.abort();
      }
      pollingControllersRef.current.clear();
    },
    [],
  );

  const waitForJobCompletion = useCallback((jobId: string) => {
    const existing = snapshotsRef.current.get(jobId);
    if (existing && isTerminalJob(existing)) return Promise.resolve(existing);

    let waiter: JobWaiter;
    const trackedPromise = new Promise<JobSnapshot>((resolve, reject) => {
      waiter = { reject, resolve };
      const matching = waitersRef.current.get(jobId) || [];
      matching.push(waiter);
      waitersRef.current.set(jobId, matching);
    });
    const pollingController = existing ? null : new AbortController();
    if (pollingController) pollingControllersRef.current.add(pollingController);
    const completion = existing
      ? trackedPromise
      : Promise.race([
          trackedPromise,
          waitForJob(jobId, { signal: pollingController?.signal }),
        ]);

    return completion.finally(() => {
      pollingController?.abort();
      if (pollingController) {
        pollingControllersRef.current.delete(pollingController);
      }
      const matching = waitersRef.current.get(jobId);
      if (!matching) return;
      const remaining = matching.filter((item) => item !== waiter);
      if (remaining.length > 0) waitersRef.current.set(jobId, remaining);
      else waitersRef.current.delete(jobId);
    });
  }, []);

  return useMemo(
    () => ({
      activeJobEntityKeys: Array.from(
        new Set(jobs.map(getJobEntityKey).filter(Boolean)),
      ),
      jobs,
      waitForJobCompletion,
    }),
    [jobs, waitForJobCompletion],
  );
}

export type { JobTrackerState };
