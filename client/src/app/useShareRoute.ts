import { useCallback, useEffect, useState } from "react";
import { fetchSharedCapsule } from "../api/capsules";
import type { ShareMetadata, StatusState, UserLike } from "./appTypes";

type UseShareRouteOptions = {
  clearNavigationShareRoute: () => void;
  hasProfile: boolean;
  isMountedRef: { current: boolean };
  pendingShareId: string;
  profileCreated: boolean;
  resolveErrorMessage: (error: { message?: string } | null | undefined) => string;
  sessionInitialized: boolean;
  setStatus: (status: StatusState) => void;
  user: UserLike | null;
};

function canLoadShareMetadata(options: UseShareRouteOptions) {
  return Boolean(
    options.sessionInitialized &&
    options.pendingShareId &&
    options.user &&
    (options.hasProfile || options.profileCreated)
  );
}

export function useShareRoute(options: UseShareRouteOptions) {
  const [shareMetadata, setShareMetadata] = useState<ShareMetadata | null>(null);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isShareLoading, setIsShareLoading] = useState(false);

  const clearShareRoute = useCallback(() => {
    setShareMetadata(null);
    setIsShareDialogOpen(false);
    options.clearNavigationShareRoute();
  }, [options]);

  useEffect(() => {
    if (!canLoadShareMetadata(options)) {
      return undefined;
    }

    let isActive = true;
    setIsShareLoading(true);
    fetchSharedCapsule(options.pendingShareId)
      .then((metadata) => {
        if (!isActive || !options.isMountedRef.current) {
          return;
        }
        setShareMetadata(metadata as ShareMetadata);
        setIsShareDialogOpen(true);
      })
      .catch((error) => {
        if (!isActive || !options.isMountedRef.current) {
          return;
        }
        options.setStatus({ loading: false, error: options.resolveErrorMessage(error), infoKey: "", infoParams: null });
        clearShareRoute();
      })
      .finally(() => {
        if (isActive && options.isMountedRef.current) {
          setIsShareLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [clearShareRoute, options]);

  return {
    clearShareRoute,
    isShareDialogOpen,
    isShareLoading,
    setIsShareLoading,
    shareMetadata
  };
}
