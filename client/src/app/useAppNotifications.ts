import { useCallback, useState } from "react";
import { initialNotificationPrompt } from "./appConstants";

type TranslationFn = (key: string, params?: Record<string, unknown>) => string;

function isNotificationApiSupported() {
  return (
    typeof window !== "undefined" && typeof window.Notification === "function"
  );
}

export function useAppNotifications(t: TranslationFn, settingsLlm: string) {
  const [notificationPrompt, setNotificationPrompt] = useState(
    initialNotificationPrompt,
  );

  const getNotificationPermission = useCallback(
    () =>
      isNotificationApiSupported()
        ? window.Notification.permission
        : "unsupported",
    [],
  );

  const closeNotificationPrompt = useCallback(() => {
    setNotificationPrompt(initialNotificationPrompt);
  }, []);

  const shouldShowNotificationPrompt = useCallback(
    (llm = settingsLlm) =>
      llm !== "none" && getNotificationPermission() === "default",
    [getNotificationPermission, settingsLlm],
  );

  const requestBrowserNotificationPermission = useCallback(async () => {
    if (!isNotificationApiSupported()) {
      return "unsupported";
    }

    try {
      const permission = await window.Notification.requestPermission();
      if (permission !== "default") {
        closeNotificationPrompt();
      }
      return permission;
    } catch {
      return getNotificationPermission();
    }
  }, [closeNotificationPrompt, getNotificationPermission]);

  const openPendingNotificationPrompt = useCallback(
    (llm = settingsLlm) => {
      if (shouldShowNotificationPrompt(llm)) {
        setNotificationPrompt({ open: true });
        return;
      }

      closeNotificationPrompt();
    },
    [closeNotificationPrompt, settingsLlm, shouldShowNotificationPrompt],
  );

  const sendReadyNotification = useCallback(
    (kind: string) => {
      if (getNotificationPermission() !== "granted") {
        return;
      }

      const bodyKey =
        kind === "partial"
          ? "notifications.ready.partialBody"
          : kind === "image"
            ? "notifications.ready.imageBody"
            : "notifications.ready.fullBody";

      try {
        new window.Notification(t("notifications.ready.title"), {
          body: t(bodyKey),
        });
      } catch {
        // Ignore browser-level notification errors and keep the UI responsive.
      }
    },
    [getNotificationPermission, t],
  );

  return {
    notificationPrompt,
    closeNotificationPrompt,
    openPendingNotificationPrompt,
    requestBrowserNotificationPermission,
    sendReadyNotification,
  };
}
