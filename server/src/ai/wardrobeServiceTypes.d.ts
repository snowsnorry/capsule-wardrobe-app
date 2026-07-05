import type { getProfile } from "../profileStore.js";
import type {
  getCapsule,
  getEffectiveCapsuleSnapshot,
  renameCapsule,
  updateCapsuleSnapshot,
} from "../capsuleStore.js";
import type { buildCapsuleEventSnapshot } from "./capsuleEvents.js";
import type {
  generateSwimwearAddition,
  shouldCompleteSelectedSwimwear,
  shouldGenerateSwimwear,
} from "./swimwear.js";
import type {
  LogContextLike,
  PartialRegenerationJobState,
  UserProfileLike,
  WardrobeGenerationResult,
} from "./types.js";

type WardrobeServiceRuntimeDeps = {
  getProfileImpl: typeof getProfile;
  getCapsuleImpl: typeof getCapsule;
  renameCapsuleImpl: typeof renameCapsule;
  updateCapsuleSnapshotImpl: typeof updateCapsuleSnapshot;
  generateCapsuleWardrobeImpl: (
    userProfile?: UserProfileLike | null,
    logContext?: LogContextLike | null,
    options?: { signal?: AbortSignal | null },
  ) => Promise<WardrobeGenerationResult>;
  shouldGenerateSwimwearImpl: typeof shouldGenerateSwimwear;
  shouldCompleteSelectedSwimwearImpl: typeof shouldCompleteSelectedSwimwear;
  generateSwimwearAdditionImpl: typeof generateSwimwearAddition;
  getPartialRegenerationJobImpl: (
    email: string,
    capsuleId: string,
  ) => PartialRegenerationJobState | null;
  buildCapsuleEventSnapshotImpl: typeof buildCapsuleEventSnapshot;
  publishSnapshotImpl: (
    email: string,
    capsuleId: string,
    snapshot: unknown,
  ) => void;
  nowMsImpl: () => number;
  randomUuidImpl: () => string;
};

type StartWardrobeJobOptions = {
  allowAutoRename?: boolean;
  forceEmptyWardrobe?: boolean;
  rollbackSnapshot?: ReturnType<typeof getEffectiveCapsuleSnapshot> | null;
};

export type { StartWardrobeJobOptions, WardrobeServiceRuntimeDeps };
