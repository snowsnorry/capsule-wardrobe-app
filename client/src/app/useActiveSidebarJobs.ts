import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  addJobSnapshotListener,
  fetchActiveJobs,
  fetchJob,
  getJobEntityKey,
  subscribeJobEvents,
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

function mergeJobSnapshot(
  current: JobSnapshot[],
  nextJob: JobSnapshot,
): JobSnapshot[] {
  if (isTerminalJob(nextJob)) {
    return current.filter((item) => item.id !== nextJob.id);
  }
  const existingIndex = current.findIndex((item) => item.id === nextJob.id);
  if (existingIndex < 0) {
    return [...current, nextJob];
  }
  return current.map((item) => (item.id === nextJob.id ? nextJob : item));
}

function mergeActiveJobs(
  current: JobSnapshot[],
  nextActiveJobs: JobSnapshot[],
) {
  const nextActiveIds = new Set(nextActiveJobs.map((job) => job.id));
  const disappearedJobs = current.filter((job) => !nextActiveIds.has(job.id));
  return { disappearedJobs, jobs: nextActiveJobs };
}

function useTrackedJobsState() {
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const jobsRef = useRef<JobSnapshot[]>([]);
  const setTrackedJobs = useCallback((next: SetStateAction<JobSnapshot[]>) => {
    setJobs((current) => {
      const resolved =
        typeof next === "function"
          ? (next as (current: JobSnapshot[]) => JobSnapshot[])(current)
          : next;
      jobsRef.current = resolved;
      return resolved;
    });
  }, []);
  return { jobs, jobsRef, setTrackedJobs };
}

function resolveWaiters(
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>,
  job: JobSnapshot,
) {
  if (!isTerminalJob(job)) return;
  const waiters = waitersRef.current.get(job.id);
  if (!waiters) return;
  waitersRef.current.delete(job.id);
  for (const waiter of waiters) {
    waiter.resolve(job);
  }
}

function rejectAllWaiters(
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>,
  error: unknown,
) {
  for (const waiters of waitersRef.current.values()) {
    for (const waiter of waiters) {
      waiter.reject(error);
    }
  }
  waitersRef.current.clear();
}

function useWaitForJobCompletion({
  jobsRef,
  waitersRef,
}: {
  jobsRef: { current: JobSnapshot[] };
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>;
}) {
  return useCallback(
    (jobId: string) => {
      const existingJob = jobsRef.current.find((job) => job.id === jobId);
      if (existingJob && isTerminalJob(existingJob)) {
        return Promise.resolve(existingJob);
      }
      const waiter: JobWaiter = {
        reject: () => undefined,
        resolve: () => undefined,
      };
      const trackedPromise = new Promise<JobSnapshot>((resolve, reject) => {
        waiter.reject = reject;
        waiter.resolve = resolve;
        const waiters = waitersRef.current.get(jobId) || [];
        waiters.push(waiter);
        waitersRef.current.set(jobId, waiters);
      });
      return Promise.race([trackedPromise, waitForJob(jobId)]).finally(() => {
        const waiters = waitersRef.current.get(jobId);
        if (!waiters) return;
        const nextWaiters = waiters.filter((item) => item !== waiter);
        if (nextWaiters.length > 0) {
          waitersRef.current.set(jobId, nextWaiters);
        } else {
          waitersRef.current.delete(jobId);
        }
      });
    },
    [jobsRef, waitersRef],
  );
}

function useJobSnapshotBus({
  setTrackedJobs,
  userEmail,
  waitersRef,
}: {
  setTrackedJobs: Dispatch<SetStateAction<JobSnapshot[]>>;
  userEmail: string;
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>;
}) {
  useEffect(() => {
    if (!userEmail) return undefined;
    return addJobSnapshotListener((job) => {
      resolveWaiters(waitersRef, job);
      setTrackedJobs((current) => mergeJobSnapshot(current, job));
    });
  }, [setTrackedJobs, userEmail, waitersRef]);
}

function useJobDiscovery({
  jobsRef,
  onDiscovery,
  setTrackedJobs,
  userEmail,
  waitersRef,
}: {
  jobsRef: { current: JobSnapshot[] };
  onDiscovery: () => void;
  setTrackedJobs: Dispatch<SetStateAction<JobSnapshot[]>>;
  userEmail: string;
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>;
}) {
  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    function clearDiscoveryTimer() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
    }

    async function reconcileDisappearedJob(jobId: string) {
      try {
        const { job } = await fetchJob(jobId);
        if (active) {
          resolveWaiters(waitersRef, job);
          setTrackedJobs((current) => mergeJobSnapshot(current, job));
        }
      } catch {
        // If a disappeared job can no longer be fetched, keep it removed from
        // active UI. The next discovery can restore it if it is still active.
      }
    }

    function scheduleNextDiscovery() {
      clearDiscoveryTimer();
      if (!active || !userEmail || !isVisibleDocument()) return;
      timer = window.setTimeout(() => {
        timer = undefined;
        void loadActiveJobs();
      }, DISCOVERY_INTERVAL_MS);
    }

    async function loadActiveJobs() {
      if (!userEmail) {
        setTrackedJobs([]);
        clearDiscoveryTimer();
        return;
      }
      if (!isVisibleDocument()) {
        clearDiscoveryTimer();
        return;
      }
      try {
        const response = await fetchActiveJobs({ force: true });
        const merged = mergeActiveJobs(jobsRef.current, response.jobs);
        if (active) {
          setTrackedJobs(merged.jobs);
          onDiscovery();
          for (const job of merged.disappearedJobs) {
            void reconcileDisappearedJob(job.id);
          }
        }
      } catch {
        // Keep last known active jobs on transient list failures.
      } finally {
        if (active) {
          scheduleNextDiscovery();
        }
      }
    }

    const onVisibilityChange = () => {
      if (!active || !userEmail) return;
      if (!isVisibleDocument()) {
        clearDiscoveryTimer();
        return;
      }
      void loadActiveJobs();
    };

    void loadActiveJobs();
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      active = false;
      clearDiscoveryTimer();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [jobsRef, onDiscovery, setTrackedJobs, userEmail, waitersRef]);
}

function useJobEventStreams({
  activeJobIds,
  discoveryVersion,
  setTrackedJobs,
  userEmail,
  waitersRef,
}: {
  activeJobIds: string;
  discoveryVersion: number;
  setTrackedJobs: Dispatch<SetStateAction<JobSnapshot[]>>;
  userEmail: string;
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>;
}) {
  const controllersRef = useRef(new Map<string, AbortController>());
  const [visibilityVersion, setVisibilityVersion] = useState(0);

  const abortAllStreams = useCallback(() => {
    for (const controller of controllersRef.current.values()) {
      controller.abort();
    }
    controllersRef.current.clear();
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      setVisibilityVersion((current) => current + 1);
      if (!isVisibleDocument()) {
        abortAllStreams();
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [abortAllStreams]);

  useEffect(() => {
    if (!userEmail || !isVisibleDocument()) {
      abortAllStreams();
      return;
    }

    const nextJobIds = new Set(activeJobIds.split("\n").filter(Boolean));
    for (const [jobId, controller] of controllersRef.current.entries()) {
      if (!nextJobIds.has(jobId)) {
        controller.abort();
        controllersRef.current.delete(jobId);
      }
    }
    for (const jobId of nextJobIds) {
      if (controllersRef.current.has(jobId)) continue;
      const controller = new AbortController();
      controllersRef.current.set(jobId, controller);
      void subscribeJobEvents({
        id: jobId,
        signal: controller.signal,
        onJob(job) {
          resolveWaiters(waitersRef, job);
          setTrackedJobs((current) => mergeJobSnapshot(current, job));
        },
      })
        .catch(() => undefined)
        .finally(() => {
          if (controllersRef.current.get(jobId) !== controller) return;
          controllersRef.current.delete(jobId);
        });
    }
  }, [
    abortAllStreams,
    activeJobIds,
    discoveryVersion,
    setTrackedJobs,
    userEmail,
    visibilityVersion,
    waitersRef,
  ]);

  useEffect(
    () => () => {
      abortAllStreams();
    },
    [abortAllStreams],
  );
}

function useClearJobsWhenSignedOut({
  setTrackedJobs,
  userEmail,
  waitersRef,
}: {
  setTrackedJobs: Dispatch<SetStateAction<JobSnapshot[]>>;
  userEmail: string;
  waitersRef: MutableRefObject<Map<string, JobWaiter[]>>;
}) {
  useEffect(() => {
    if (userEmail) return;
    setTrackedJobs([]);
    rejectAllWaiters(waitersRef, new Error("job_wait_aborted"));
  }, [setTrackedJobs, userEmail, waitersRef]);
}

function useActiveJobIds(jobs: JobSnapshot[]) {
  return useMemo(
    () =>
      jobs
        .map((job) => job.id)
        .sort()
        .join("\n"),
    [jobs],
  );
}

export function useJobTracker(userEmail: string): JobTrackerState {
  const { jobs, jobsRef, setTrackedJobs } = useTrackedJobsState();
  const waitersRef = useRef(new Map<string, JobWaiter[]>());
  const [discoveryVersion, setDiscoveryVersion] = useState(0);
  const activeJobIds = useActiveJobIds(jobs);
  const waitForJobCompletion = useWaitForJobCompletion({
    jobsRef,
    waitersRef,
  });

  useClearJobsWhenSignedOut({ setTrackedJobs, userEmail, waitersRef });
  useJobSnapshotBus({ setTrackedJobs, userEmail, waitersRef });
  const noteDiscovery = useCallback(() => {
    setDiscoveryVersion((current) => current + 1);
  }, []);
  useJobDiscovery({
    jobsRef,
    onDiscovery: noteDiscovery,
    setTrackedJobs,
    userEmail,
    waitersRef,
  });
  useJobEventStreams({
    activeJobIds,
    discoveryVersion,
    setTrackedJobs,
    userEmail,
    waitersRef,
  });

  return useMemo(
    () => ({
      activeJobEntityKeys: jobs.map(getJobEntityKey).filter(Boolean),
      jobs,
      waitForJobCompletion,
    }),
    [jobs, waitForJobCompletion],
  );
}

export type { JobTrackerState };
