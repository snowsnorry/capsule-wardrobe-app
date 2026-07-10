import { useEffect, useRef } from "react";
import { fetchCapsule } from "../api/capsules";
import { addJobSnapshotListener, type JobSnapshot } from "../api/jobs";
import type { AppControllerOperations } from "./appControllerOperations";
import { refreshCapsuleList } from "./capsuleListActions";
import { refreshActiveOutfit } from "./outfitActionHelpers";
import type { useAppState } from "./useAppState";

const CAPSULE_CONTENT_JOB_KINDS = new Set([
  "capsuleGenerate",
  "capsuleRegenerateSelected",
  "outfitSetImageGenerate",
]);

function isTerminal(job: JobSnapshot) {
  return job.status === "completed" || job.status === "failed";
}

// eslint-disable-next-line max-lines-per-function
export function useJobEntityReconciliation({
  appState,
  operations,
  resolveErrorMessage,
  userEmail,
}: {
  appState: ReturnType<typeof useAppState>;
  operations: AppControllerOperations;
  resolveErrorMessage: (error: { message?: string } | null) => string;
  userEmail: string;
}) {
  const handledRef = useRef(new Set<string>());

  // eslint-disable-next-line max-lines-per-function
  useEffect(() => {
    if (!userEmail) {
      handledRef.current.clear();
      return undefined;
    }

    let active = true;
    const inFlight = new Set<string>();

    const clearPendingAfterFailedRefresh = (job: JobSnapshot) => {
      if (CAPSULE_CONTENT_JOB_KINDS.has(job.kind)) {
        appState.setIsLoadingItems(false);
        appState.setIsWardrobePending(false);
        appState.setHasPendingAdditionalItems(false);
        appState.setIsPartialRegenerationLoading(false);
      }
      if (job.kind === "capsuleReportGenerate") {
        appState.setIsCapsuleReportPending(false);
      }
      if (job.kind === "outfitImageGenerate") {
        appState.setIsOutfitImagePending(false);
      }
      if (job.kind === "outfitReportGenerate") {
        appState.setIsOutfitReportPending(false);
      }
    };

    // eslint-disable-next-line complexity
    const reconcileEntity = async (job: JobSnapshot) => {
      const context = operations.getAppActionContext();
      if (job.entity?.type === "capsule" && job.entity.id) {
        const capsuleId = job.entity.id;
        if (appState.activeCapsuleIdRef.current === capsuleId) {
          const result = (await fetchCapsule(capsuleId)) as {
            capsule?: unknown;
            snapshot?: Record<string, unknown>;
          };
          if (result.capsule) {
            operations.applyCapsuleState(result.capsule as never);
          }
          if (result.snapshot && CAPSULE_CONTENT_JOB_KINDS.has(job.kind)) {
            await operations.applyWardrobeSnapshot(
              job.status === "failed"
                ? { ...result.snapshot, status: "failed" }
                : result.snapshot,
              capsuleId,
              { refreshReadyCapsule: false },
            );
          }
          if (job.kind === "capsuleReportGenerate") {
            appState.setIsCapsuleReportPending(false);
          }
        }
        if (isTerminal(job)) await refreshCapsuleList(context);
      }

      if (job.entity?.type === "outfit" && job.entity.id && isTerminal(job)) {
        await refreshActiveOutfit(context, job.entity.id, {
          onlyIfActive: true,
        });
      }
    };

    const reconcileWithRetry = async (job: JobSnapshot, key: string) => {
      inFlight.add(key);
      try {
        for (let attempt = 0; attempt < 4 && active; attempt += 1) {
          try {
            await reconcileEntity(job);
            if (active) handledRef.current.add(key);
            return;
          } catch {
            if (attempt < 3) {
              await new Promise((resolve) =>
                window.setTimeout(resolve, 250 * 2 ** attempt),
              );
            }
          }
        }
        if (!active) return;
        clearPendingAfterFailedRefresh(job);
        appState.setStatus((current) => ({
          ...current,
          error: resolveErrorMessage({ message: "service_unavailable" }),
        }));
      } finally {
        inFlight.delete(key);
      }
    };

    const unsubscribe = addJobSnapshotListener((job) => {
      const shouldRefreshExtras =
        job.kind === "capsuleGenerate" &&
        job.status === "running" &&
        job.phase === "extras";
      if (!isTerminal(job) && !shouldRefreshExtras) return;

      const key = `${job.id}:${job.updatedAt}:${job.status}:${job.phase}`;
      if (handledRef.current.has(key) || inFlight.has(key)) return;
      void reconcileWithRetry(job, key);

      if (job.status === "failed") {
        appState.setStatus((current) => ({
          ...current,
          error: resolveErrorMessage({
            message: job.error?.code || "service_unavailable",
          }),
        }));
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [appState, operations, resolveErrorMessage, userEmail]);
}
