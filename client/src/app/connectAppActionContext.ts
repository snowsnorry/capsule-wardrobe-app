import { buildAppActionContext } from "./buildAppActionContext";
import type { AppControllerOperations } from "./useAppControllerOperations";
import type { useAppHandlers } from "./useAppHandlers";
import type { useAppNavigation } from "./useAppNavigation";
import type { useAppNotifications } from "./useAppNotifications";
import type { useAppState } from "./useAppState";
import type { useShareRoute } from "./useShareRoute";

type ConnectAppActionContextOptions = {
  appState: ReturnType<typeof useAppState>;
  handlers: ReturnType<typeof useAppHandlers>;
  locale: string;
  navigation: ReturnType<typeof useAppNavigation>;
  notifications: ReturnType<typeof useAppNotifications>;
  operations: AppControllerOperations;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  setLocale: (locale: string) => void;
  shareRoute: ReturnType<typeof useShareRoute>;
  t: (key: string, params?: Record<string, unknown>) => string;
};

export function connectAppActionContext({
  appState,
  handlers,
  locale,
  navigation,
  notifications,
  operations,
  resolveErrorMessage,
  setLocale,
  shareRoute,
  t,
}: ConnectAppActionContextOptions) {
  operations.getAppActionContext = () =>
    buildAppActionContext({
      appState,
      applyCapsuleState: operations.applyCapsuleState,
      applyWardrobeSnapshot: operations.applyWardrobeSnapshot,
      bootstrapCapsules: operations.bootstrapCapsules,
      buildCurrentDraftSnapshot: operations.buildCurrentDraftSnapshot,
      clearShareRoute: shareRoute.clearShareRoute,
      closeNotificationPrompt: notifications.closeNotificationPrompt,
      handlers,
      locale,
      pendingShareId: navigation.pendingShareId,
      resolveErrorMessage,
      setIsShareLoading: shareRoute.setIsShareLoading,
      setLocale,
      shareMetadata: shareRoute.shareMetadata,
      startCapsuleEventStream: operations.startCapsuleEventStream,
      startPendingNotificationFlow: operations.startPendingNotificationFlow,
      t,
    });
}
