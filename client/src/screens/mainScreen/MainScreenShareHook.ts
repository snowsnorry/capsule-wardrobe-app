import { useCallback, useState } from "react";
import { hasUploadedPersonalWardrobeItems } from "../../../../shared/capsuleShareItems.js";
import { capsuleCanRequestShare } from "./MainScreenHelpers";
import type { CapsuleLike, MainScreenProps } from "./MainScreenTypes";

type ShareState = {
  open: boolean;
  url: string;
  expiresAt: string | Date | null;
  name: string;
  copied: boolean;
  loading: boolean;
  blockedReason: "personal_uploaded_items" | null;
};

type ReadShareResult =
  | { blockedReason: "personal_uploaded_items" }
  | { url: string; expiresAt: string | Date | null }
  | null;

function canStartShare(
  capsule: CapsuleLike | null | undefined,
  disabled: boolean,
  allowUnknownContent: boolean,
) {
  return (
    Boolean(capsule?.id) &&
    !disabled &&
    capsuleCanRequestShare(capsule, { allowUnknownContent })
  );
}

function readShareResult(
  result: Awaited<ReturnType<NonNullable<MainScreenProps["onShareCapsule"]>>>,
): ReadShareResult {
  const data = result && typeof result === "object" ? result : null;
  if (data?.blockedReason === "personal_uploaded_items") {
    return { blockedReason: data.blockedReason };
  }
  const url = typeof data?.url === "string" ? data.url : "";
  return url ? { url, expiresAt: data?.expiresAt || null } : null;
}

function getCapsuleShareSnapshot(capsule: CapsuleLike | null | undefined) {
  return (capsule?.draft || capsule?.saved || null) as unknown;
}

function useShareCapsule(
  props: MainScreenProps,
  interactionDisabled: boolean,
  activeName: string,
) {
  const [share, setShare] = useState<ShareState>({
    open: false,
    url: "",
    expiresAt: null,
    name: "",
    copied: false,
    loading: false,
    blockedReason: null,
  });
  const openBlockedShareDialog = useCallback(
    (capsule: CapsuleLike | null | undefined) => {
      setShare({
        open: true,
        url: "",
        expiresAt: null,
        name: capsule?.name || activeName,
        copied: false,
        loading: false,
        blockedReason: "personal_uploaded_items",
      });
    },
    [activeName],
  );
  const shareCapsule = useCallback(
    async (capsule = props.activeCapsule, allowUnknownContent = false) => {
      if (!canStartShare(capsule, interactionDisabled, allowUnknownContent))
        return;
      if (hasUploadedPersonalWardrobeItems(getCapsuleShareSnapshot(capsule))) {
        openBlockedShareDialog(capsule);
        return;
      }
      setShare((state) => ({
        ...state,
        loading: true,
        blockedReason: null,
      }));
      try {
        const result = await props.onShareCapsule?.(capsule.id);
        const shareData = readShareResult(result);
        if (
          shareData &&
          "blockedReason" in shareData &&
          shareData.blockedReason === "personal_uploaded_items"
        ) {
          openBlockedShareDialog(capsule);
        } else if (shareData && "url" in shareData)
          setShare({
            open: true,
            url: shareData.url,
            expiresAt: shareData.expiresAt,
            name: capsule.name || activeName,
            copied: false,
            loading: false,
            blockedReason: null,
          });
      } finally {
        setShare((state) => ({ ...state, loading: false }));
      }
    },
    [activeName, interactionDisabled, openBlockedShareDialog, props],
  );
  return { share, setShare, shareCapsule };
}

export { useShareCapsule };
export type { ShareState };
