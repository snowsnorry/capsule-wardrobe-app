import type { AppActionContext } from "./actionContext";
import type {
  CapsuleDraft,
  CapsuleBootstrapResult,
  CapsuleMeta,
  CapsulePagination,
  CapsuleWardrobeData,
  OutfitMeta,
  OutfitSetSnapshot,
  WardrobeItem,
  WardrobeSnapshot,
} from "./appTypes";

export type AppControllerOperations = {
  applyCapsuleState: (
    capsule: CapsuleMeta | null | undefined,
    options?: {
      capsules?: CapsuleMeta[] | null;
      pagination?: CapsulePagination | null;
    },
  ) => void;
  applyWardrobeSnapshot: (
    snapshot: WardrobeSnapshot | undefined,
    capsuleId?: string,
    options?: { refreshReadyCapsule?: boolean },
  ) => Promise<void>;
  bootstrapCapsules: (email?: string) => Promise<CapsuleBootstrapResult>;
  buildCurrentDraftSnapshot: (options?: {
    wardrobe?:
      | CapsuleWardrobeData
      | { items: WardrobeItem[] | null; outfitSets: OutfitSetSnapshot[] }
      | null;
    rejectedUrls?: string[] | null;
  }) => CapsuleDraft;
  clearWardrobeProgressState: () => void;
  clearActiveCapsuleState: (options?: {
    capsules?: CapsuleMeta[] | null;
    pagination?: CapsulePagination | null;
  }) => void;
  clearActiveOutfitState: (options?: {
    outfits?: OutfitMeta[] | null;
    pagination?: CapsulePagination | null;
  }) => void;
  getAppActionContext: () => AppActionContext;
  startCapsuleEventStream: (capsuleId: string | undefined) => unknown;
  startPendingNotificationFlow: (kind: string, llm?: string) => void;
};
