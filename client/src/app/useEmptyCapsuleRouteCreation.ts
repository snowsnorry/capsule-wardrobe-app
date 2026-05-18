import { useEffect, useRef } from "react";
import type { AppRoute, StatusState } from "./appTypes";

type EmptyCapsuleRouteCreationOptions = {
  activeCapsuleId: string;
  appRoute: AppRoute;
  capsuleListLength: number;
  createCapsule: () => Promise<void>;
  hasUsableProfile: boolean;
  isContentOperationLoading: boolean;
  pendingShareId: string;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  sessionInitialized: boolean;
  setStatus: (status: StatusState) => void;
  userEmail: string;
};

function shouldCreateEmptyCapsule({
  activeCapsuleId,
  appRoute,
  capsuleListLength,
  hasUsableProfile,
  isContentOperationLoading,
  pendingShareId,
  sessionInitialized,
  userEmail,
}: EmptyCapsuleRouteCreationOptions) {
  return Boolean(
    sessionInitialized &&
    userEmail &&
    hasUsableProfile &&
    appRoute === "capsule" &&
    !pendingShareId &&
    !activeCapsuleId &&
    capsuleListLength === 0 &&
    !isContentOperationLoading,
  );
}

function shouldResetAttempt({
  activeCapsuleId,
  appRoute,
  capsuleListLength,
  pendingShareId,
}: EmptyCapsuleRouteCreationOptions) {
  return Boolean(
    activeCapsuleId ||
    capsuleListLength > 0 ||
    appRoute !== "capsule" ||
    pendingShareId,
  );
}

export function useEmptyCapsuleRouteCreation(
  options: EmptyCapsuleRouteCreationOptions,
) {
  const attemptedCreationKeyRef = useRef("");
  const creationKey = [
    options.userEmail,
    options.appRoute,
    options.pendingShareId,
  ].join(":");

  useEffect(() => {
    if (!shouldCreateEmptyCapsule(options)) {
      if (shouldResetAttempt(options)) {
        attemptedCreationKeyRef.current = "";
      }
      return;
    }

    if (attemptedCreationKeyRef.current === creationKey) {
      return;
    }

    attemptedCreationKeyRef.current = creationKey;
    void options.createCapsule().catch((error) => {
      options.setStatus({
        loading: false,
        error: options.resolveErrorMessage(error),
        infoKey: "",
        infoParams: null,
      });
    });
  }, [creationKey, options]);
}
