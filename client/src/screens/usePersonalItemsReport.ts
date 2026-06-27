import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import {
  deletePersonalItemsReport,
  fetchPersonalItemsReport,
  generatePersonalItemsReport,
  type PersonalItemsReportResponse,
} from "../api/personalItems";
import { waitForJob } from "../api/jobs";
import type { PersonalItemsReport } from "../app/appTypes";

type UsePersonalItemsReportOptions = {
  setError: (error: string) => void;
  t: (key: string) => string;
};

type ReportStateSetters = {
  setGeneratedAt: Dispatch<SetStateAction<string | null>>;
  setReport: Dispatch<SetStateAction<PersonalItemsReport | null>>;
  setStale: Dispatch<SetStateAction<boolean>>;
};

function applyReportResponse(
  response: PersonalItemsReportResponse,
  setters: ReportStateSetters,
) {
  setters.setReport(response.report || null);
  setters.setGeneratedAt(response.generatedAt || null);
  setters.setStale(Boolean(response.stale));
}

function clearReportState(setters: ReportStateSetters) {
  setters.setReport(null);
  setters.setGeneratedAt(null);
  setters.setStale(false);
}

function useInitialReportLoad({
  setError,
  setters,
  setIsLoadingReport,
  t,
}: UsePersonalItemsReportOptions & {
  setIsLoadingReport: Dispatch<SetStateAction<boolean>>;
  setters: ReportStateSetters;
}) {
  useEffect(() => {
    let isActive = true;
    setIsLoadingReport(true);
    const loadReport = async () => {
      try {
        const response = await fetchPersonalItemsReport({ force: false });
        if (isActive) applyReportResponse(response, setters);
      } catch {
        if (isActive) {
          clearReportState(setters);
          setError(t("wardrobe.reportLoadFailed"));
        }
      } finally {
        if (isActive) setIsLoadingReport(false);
      }
    };

    void loadReport();

    return () => {
      isActive = false;
    };
  }, [setError, setIsLoadingReport, setters, t]);
}

function usePersonalItemsReport({
  setError,
  t,
}: UsePersonalItemsReportOptions) {
  const [report, setReport] = useState<PersonalItemsReport | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [isReportPending, setIsReportPending] = useState(false);
  const [stale, setStale] = useState(false);
  const setters = useMemo(() => ({ setGeneratedAt, setReport, setStale }), []);

  const refreshReport = useCallback(
    async ({ force = true }: { force?: boolean } = {}) => {
      try {
        const response = await fetchPersonalItemsReport({ force });
        applyReportResponse(response, setters);
      } catch {
        clearReportState(setters);
        setError(t("wardrobe.reportLoadFailed"));
      } finally {
        setIsLoadingReport(false);
      }
    },
    [setError, setters, t],
  );

  const markStale = useCallback(() => {
    setStale((current) => current || Boolean(report));
  }, [report]);

  useInitialReportLoad({ setError, setIsLoadingReport, setters, t });

  const generateReport = async () => {
    setIsReportPending(true);
    try {
      const { job } = await generatePersonalItemsReport();
      void waitForJob(job.id)
        .then(async (finishedJob) => {
          if (finishedJob.status !== "completed") {
            throw new Error(finishedJob.error?.code || "service_unavailable");
          }
          await refreshReport({ force: true });
        })
        .catch(() => {
          setError(t("wardrobe.reportGenerateFailed"));
        })
        .finally(() => {
          setIsReportPending(false);
        });
      setError("");
    } catch {
      setError(t("wardrobe.reportGenerateFailed"));
      setIsReportPending(false);
    }
  };

  const deleteReport = async () => {
    setIsReportPending(true);
    try {
      await deletePersonalItemsReport();
      clearReportState(setters);
      setError("");
    } catch {
      setError(t("wardrobe.reportDeleteFailed"));
    } finally {
      setIsReportPending(false);
    }
  };

  return {
    deleteReport,
    generateReport,
    generatedAt,
    isLoadingReport,
    isReportPending,
    markStale,
    refreshReport,
    report,
    stale,
  };
}

export { usePersonalItemsReport };
