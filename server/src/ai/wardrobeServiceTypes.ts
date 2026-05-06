import type { getProfile } from "../profileStore.js";
import type { getCapsule, getEffectiveCapsuleSnapshot, renameCapsule, updateCapsuleSnapshot } from "../capsuleStore.js";
import type { buildCapsuleEventSnapshot } from "./capsuleEvents.js";
import type { generateSwimwearAddition, shouldGenerateSwimwear } from "./swimwear.js";
import type {
  LogContextLike,
  PartialRegenerationJobState,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeJobState
} from "./types.js";

type WardrobeServiceDependencies = {
  getProfileImpl?: typeof getProfile;
  getCapsuleImpl?: typeof getCapsule;
  renameCapsuleImpl?: typeof renameCapsule;
  updateCapsuleSnapshotImpl?: typeof updateCapsuleSnapshot;
  generateCapsuleWardrobeImpl?: (
    userProfile?: UserProfileLike | null,
    logContext?: LogContextLike | null
  ) => Promise<WardrobeGenerationResult>;
  shouldGenerateSwimwearImpl?: typeof shouldGenerateSwimwear;
  generateSwimwearAdditionImpl?: typeof generateSwimwearAddition;
  getPartialRegenerationJobImpl?: (email: string, capsuleId: string) => PartialRegenerationJobState | null;
  buildCapsuleEventSnapshotImpl?: typeof buildCapsuleEventSnapshot;
  publishSnapshotImpl?: (email: string, capsuleId: string, snapshot: unknown) => void;
  jobs?: Map<string, WardrobeJobState>;
  nowMsImpl?: () => number;
  setTimeoutImpl?: typeof setTimeout;
  randomUuidImpl?: () => string;
};

type WardrobeServiceRuntimeDeps = Required<WardrobeServiceDependencies>;

type StartWardrobeJobOptions = {
  allowAutoRename?: boolean;
  forceEmptyWardrobe?: boolean;
  rollbackSnapshot?: ReturnType<typeof getEffectiveCapsuleSnapshot> | null;
};

type StartWardrobeJobInput = {
  email: string;
  capsuleId: string;
  profile: Awaited<ReturnType<typeof getProfile>>;
  capsule: Awaited<ReturnType<typeof getCapsule>>;
  logContext?: LogContextLike | null;
  options?: StartWardrobeJobOptions;
};

type WardrobeJobGetter = (email: string, capsuleId: string) => WardrobeJobState | null;
type WardrobeJobStarter = (input: StartWardrobeJobInput) => WardrobeJobState;

export type {
  StartWardrobeJobInput,
  StartWardrobeJobOptions,
  WardrobeJobGetter,
  WardrobeJobStarter,
  WardrobeServiceDependencies,
  WardrobeServiceRuntimeDeps
};
