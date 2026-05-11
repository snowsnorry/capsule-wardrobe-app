import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSharedCapsule } from "../api/capsules";
import type { ShareMetadata, StatusState, UserLike } from "./appTypes";

type UseShareRouteOptions = {
  clearNavigationShareRoute: () => void;
  hasProfile: boolean;
  isMountedRef: { current: boolean };
  pendingShareId: string;
  profileCreated: boolean;
  resolveErrorMessage: (
    error: { message?: string } | null | undefined,
  ) => string;
  sessionInitialized: boolean;
  setStatus: (status: StatusState) => void;
  user: UserLike | null;
};

function canLoadShareMetadata(
  options: Pick<
    UseShareRouteOptions,
    "hasProfile" | "pendingShareId" | "profileCreated" | "sessionInitialized"
  >,
  hasUser: boolean,
) {
  return Boolean(
    options.sessionInitialized &&
    options.pendingShareId &&
    hasUser &&
    (options.hasProfile || options.profileCreated),
  );
}

export function useShareRoute(options: UseShareRouteOptions) {
  const {
    hasProfile,
    pendingShareId,
    profileCreated,
    sessionInitialized,
    user,
  } = options;
  const hasUser = Boolean(user);
  const latestOptionsRef = useRef(options);
  latestOptionsRef.current = options;
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | null>(
    null,
  );
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);

  const clearShareRoute = useCallback(() => {
    setShareMetadata(null);
    setIsShareDialogOpen(false);
    latestOptionsRef.current.clearNavigationShareRoute();
  }, []);

  useEffect(() => {
    if (
      !canLoadShareMetadata(
        {
          hasProfile,
          pendingShareId,
          profileCreated,
          sessionInitialized,
        },
        hasUser,
      )
    ) {
      return undefined;
    }

    let isActive = true;
    setIsShareLoading(true);
    fetchSharedCapsule(pendingShareId)
      .then((metadata) => {
        if (!isActive || !latestOptionsRef.current.isMountedRef.current) {
          return;
        }
        setShareMetadata(metadata as ShareMetadata);
        setIsShareDialogOpen(true);
      })
      .catch((error) => {
        if (!isActive || !latestOptionsRef.current.isMountedRef.current) {
          return;
        }
        latestOptionsRef.current.setStatus({
          loading: false,
          error: latestOptionsRef.current.resolveErrorMessage(error),
          infoKey: "",
          infoParams: null,
        });
        clearShareRoute();
      })
      .finally(() => {
        if (isActive && latestOptionsRef.current.isMountedRef.current) {
          setIsShareLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [
    clearShareRoute,
    hasProfile,
    pendingShareId,
    profileCreated,
    sessionInitialized,
    hasUser,
  ]);

  return {
    clearShareRoute,
    isShareDialogOpen,
    isShareLoading,
    setIsShareLoading,
    shareMetadata,
  };
}
