import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  fetchActiveJobs,
  getJobEntityKey,
  subscribeJobEvents,
  type JobSnapshot,
} from "../api/jobs";

const REFRESH_INTERVAL_MS = 2000;

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

export function useActiveSidebarJobs(userEmail: string) {
  const [jobs, setJobs] = useState<JobSnapshot[]>([]);
  const activeJobIds = useMemo(
    () =>
      jobs
        .map((job) => job.id)
        .sort()
        .join("\n"),
    [jobs],
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!userEmail) {
        setJobs([]);
        return;
      }
      try {
        const response = await fetchActiveJobs({ force: true });
        if (active) {
          setJobs(response.jobs);
        }
      } catch {
        // Keep the last known active jobs on transient failures so busy rows do
        // not briefly unlock while work may still be running.
      }
    };

    void load();
    const timer = window.setInterval(() => {
      void load();
    }, REFRESH_INTERVAL_MS);

    return () => {
      active = false;
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [userEmail]);

  useEffect(() => {
    const jobIds = activeJobIds.split("\n").filter(Boolean);
    if (!userEmail || jobIds.length === 0) {
      return undefined;
    }

    let active = true;
    const controllers = jobIds.map((jobId) =>
      subscribeActiveJob(jobId, setJobs, () => active),
    );

    return () => {
      active = false;
      for (const controller of controllers) {
        controller.abort();
      }
    };
  }, [activeJobIds, userEmail]);

  return useMemo(
    () => ({
      activeJobEntityKeys: jobs.map(getJobEntityKey).filter(Boolean),
      jobs,
    }),
    [jobs],
  );
}
