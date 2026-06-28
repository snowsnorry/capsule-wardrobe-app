import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  addJobSnapshotListener,
  fetchActiveJobs,
  getJobEntityKey,
  subscribeJobEvents,
  type JobSnapshot,
} from "../api/jobs";

const IDLE_REFRESH_INTERVAL_MS = 60_000;

function mergeJobSnapshot(
  current: JobSnapshot[],
  nextJob: JobSnapshot,
): JobSnapshot[] {
  if (nextJob.status === "completed" || nextJob.status === "failed") {
    return current.filter((item) => item.id !== nextJob.id);
  }
  const existingIndex = current.findIndex((item) => item.id === nextJob.id);
  if (existingIndex < 0) {
    return [...current, nextJob];
  }
  return current.map((item) => (item.id === nextJob.id ? nextJob : item));
}

function subscribeActiveJob(
  jobId: string,
  setJobs: Dispatch<SetStateAction<JobSnapshot[]>>,
  isActive: () => boolean,
) {
  const controller = new AbortController();
  void subscribeJobEvents({
    id: jobId,
    signal: controller.signal,
    onJob: (nextJob) => {
      if (!isActive()) return;
      setJobs((current) => mergeJobSnapshot(current, nextJob));
    },
  })
    .catch(() => undefined)
    .finally(() => {
      if (!isActive()) return;
      void fetchActiveJobs({ force: true })
        .then((response) => {
          if (isActive()) {
            setJobs(response.jobs);
          }
        })
        .catch(() => undefined);
    });
  return controller;
}

function isVisibleDocument() {
  return document.visibilityState === "visible";
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

function useActiveJobDiscovery({
  jobsRef,
  setTrackedJobs,
  userEmail,
}: {
  jobsRef: { current: JobSnapshot[] };
  setTrackedJobs: Dispatch<SetStateAction<JobSnapshot[]>>;
  userEmail: string;
}) {
  useEffect(() => {
    let active = true;
    let timer: number | undefined;

    function clearRefreshTimer() {
      if (timer === undefined) return;
      window.clearTimeout(timer);
      timer = undefined;
    }

    function scheduleRefresh(nextJobs = jobsRef.current) {
      if (!active || !userEmail || !isVisibleDocument() || nextJobs.length > 0)
        return;
      clearRefreshTimer();
      timer = window.setTimeout(() => {
        timer = undefined;
        void load();
      }, IDLE_REFRESH_INTERVAL_MS);
    }

    async function load() {
      if (!userEmail) {
        setTrackedJobs([]);
        clearRefreshTimer();
        return;
      }
      if (!isVisibleDocument()) {
        clearRefreshTimer();
        return;
      }
      let nextJobs = jobsRef.current;
      try {
        const response = await fetchActiveJobs({ force: true });
        nextJobs = response.jobs;
        if (active) {
          setTrackedJobs(response.jobs);
        }
      } catch {
        // Keep the last known active jobs on transient failures so busy rows do
        // not briefly unlock while work may still be running.
      } finally {
        if (active) {
          scheduleRefresh(nextJobs);
        }
      }
    }

    const unsubscribe = addJobSnapshotListener((job) => {
      if (!active || !userEmail) return;
      const nextJobs = mergeJobSnapshot(jobsRef.current, job);
      setTrackedJobs(nextJobs);
      scheduleRefresh(nextJobs);
    });
    const refreshVisibleJobs = () => {
      if (!active || !userEmail) return;
      if (!isVisibleDocument()) {
        clearRefreshTimer();
        return;
      }
      void load();
    };

    void load();
    document.addEventListener("visibilitychange", refreshVisibleJobs);

    return () => {
      active = false;
      clearRefreshTimer();
      unsubscribe();
      document.removeEventListener("visibilitychange", refreshVisibleJobs);
    };
  }, [jobsRef, setTrackedJobs, userEmail]);
}

export function useActiveSidebarJobs(userEmail: string) {
  const { jobs, jobsRef, setTrackedJobs } = useTrackedJobsState();
  const activeJobIds = useMemo(
    () =>
      jobs
        .map((job) => job.id)
        .sort()
        .join("\n"),
    [jobs],
  );

  useActiveJobDiscovery({ jobsRef, setTrackedJobs, userEmail });

  useEffect(() => {
    const jobIds = activeJobIds.split("\n").filter(Boolean);
    if (!userEmail || jobIds.length === 0) {
      return undefined;
    }

    let active = true;
    const controllers = jobIds.map((jobId) =>
      subscribeActiveJob(jobId, setTrackedJobs, () => active),
    );

    return () => {
      active = false;
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [activeJobIds, setTrackedJobs, userEmail]);

  return useMemo(
    () => ({
      activeJobEntityKeys: jobs.map(getJobEntityKey).filter(Boolean),
      jobs,
    }),
    [jobs],
  );
}
