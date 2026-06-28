import { buildAppActionContext } from "./buildAppActionContext";
import type { AppControllerOperations } from "./appControllerOperations";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useShareRoute } from "./useShareRoute";

export function buildDefaultActionContext({
  appState,
  locale,
  notifications,
  operations,
  resolveErrorMessage,
  setLocale,
  shareRoute,
  t,
}: {
  appState: ReturnType<typeof useAppState>;
  locale: string;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  setLocale: (locale: string) => void;
  shareRoute: ReturnType<typeof useShareRoute>;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return buildAppActionContext({
    appState,
    applyCapsuleState: operations.applyCapsuleState,
    applyWardrobeSnapshot: operations.applyWardrobeSnapshot,
    bootstrapCapsules: operations.bootstrapCapsules,
    buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
    clearShareRoute: shareRoute.clearShareRoute,
    closeNotificationPrompt: notifications.closeNotificationPrompt,
    handlers: {} as ReturnType<typeof useAppHandlers>,
    locale,
    pendingShareId: "",
    resolveErrorMessage,
    setIsShareLoading: shareRoute.setIsShareLoading,
    setLocale,
    shareMetadata: shareRoute.shareMetadata,
    startCapsuleEventStream: operations.startCapsuleEventStream,
    startPendingNotificationFlow: operations.startPendingNotificationFlow,
    t,
    waitForJobCompletion: async () => {
      throw new Error("job_tracker_unavailable");
    },
  });
}
