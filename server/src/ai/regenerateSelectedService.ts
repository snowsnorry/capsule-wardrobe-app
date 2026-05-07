import crypto from "node:crypto";
import { getProfile } from "../profileStore.js";
import { getCapsule, updateCapsuleSnapshot } from "../capsuleStore.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./capsuleEvents.js";
import { partialRegenerationJobs } from "./partialRegenerationJobs.js";
import type {
  LogContextLike,
  PartialRegenerationJobState,
  UserProfileLike,
  WardrobeGenerationResult,
  WardrobeUiItemLike,
} from "./types.js";
import { regenerateCapsuleWardrobe } from "./regenerateSelectedGeneration.js";
import {
  getPartialRegenerationJobForService,
  startPartialRegenerationJobForService,
} from "./regenerateSelectedServiceJobs.js";
import { createRegenerateSelectedWardrobeItems } from "./regenerateSelectedServiceRequest.js";

type PartialRegenerationServiceDependencies = {
  getProfileImpl?: typeof getProfile;
  getCapsuleImpl?: typeof getCapsule;
  updateCapsuleSnapshotImpl?: typeof updateCapsuleSnapshot;
  regenerateCapsuleWardrobeImpl?: (
    userProfile?: UserProfileLike | null,
    products?: WardrobeUiItemLike[] | null,
    logContext?: LogContextLike | null,
  ) => Promise<WardrobeGenerationResult>;
  buildCapsuleEventSnapshotImpl?: typeof buildCapsuleEventSnapshot;
  publishSnapshotImpl?: (
    email: string,
    capsuleId: string,
    snapshot: unknown,
  ) => void;
  jobs?: Map<string, PartialRegenerationJobState>;
  nowMsImpl?: () => number;
  setTimeoutImpl?: typeof setTimeout;
  randomUuidImpl?: () => string;
};

export function createPartialRegenerationService({
  getProfileImpl = getProfile,
  getCapsuleImpl = getCapsule,
  updateCapsuleSnapshotImpl = updateCapsuleSnapshot,
  regenerateCapsuleWardrobeImpl = regenerateCapsuleWardrobe,
  buildCapsuleEventSnapshotImpl = buildCapsuleEventSnapshot,
  publishSnapshotImpl = (email, capsuleId, snapshot) =>
    capsuleEventHub.publish(email, capsuleId, snapshot),
  jobs = partialRegenerationJobs,
  nowMsImpl = () => Date.now(),
  setTimeoutImpl = setTimeout,
  randomUuidImpl = () => crypto.randomUUID(),
}: PartialRegenerationServiceDependencies = {}) {
  const deps = {
    buildCapsuleEventSnapshotImpl,
    getCapsuleImpl,
    getProfileImpl,
    jobs,
    nowMsImpl,
    publishSnapshotImpl,
    randomUuidImpl,
    regenerateCapsuleWardrobeImpl,
    setTimeoutImpl,
    updateCapsuleSnapshotImpl,
  };

  function getPartialRegenerationJob(email: string, capsuleId: string) {
    return getPartialRegenerationJobForService(deps, email, capsuleId);
  }

  function startPartialRegenerationJob(...args) {
    const [
      email,
      capsuleId,
      profile,
      capsule,
      selectedProducts,
      storedWardrobe,
      logContext = null,
    ] = args;
    return startPartialRegenerationJobForService(deps, {
      email,
      capsuleId,
      profile,
      capsule,
      selectedProducts,
      storedWardrobe,
      logContext,
    });
  }

  const regenerateSelectedWardrobeItems = createRegenerateSelectedWardrobeItems(
    deps,
    getPartialRegenerationJob,
    startPartialRegenerationJob,
  );

  return {
    getPartialRegenerationJob,
    startPartialRegenerationJob,
    regenerateSelectedWardrobeItems,
  };
}
