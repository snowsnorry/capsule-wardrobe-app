import crypto from "node:crypto";
import { getProfile } from "../profileStore.js";
import {
  getCapsule,
  renameCapsule,
  updateCapsuleSnapshot,
} from "../capsuleStore.js";
import {
  generateSwimwearAddition,
  shouldGenerateSwimwear,
} from "./swimwear.js";
import { getPartialRegenerationJob } from "./partialRegenerationJobs.js";
import { buildCapsuleEventSnapshot, capsuleEventHub } from "./capsuleEvents.js";
import { generateCapsuleWardrobe } from "./aiGeneration.js";
import {
  getWardrobeJobForService,
  startWardrobeJobForService,
} from "./wardrobeJobService.js";
import {
  createGetCapsuleItems,
  createRegenerateCapsuleWardrobe,
} from "./wardrobeServiceHandlers.js";
import type {
  StartWardrobeJobOptions,
  WardrobeServiceDependencies,
  WardrobeServiceRuntimeDeps,
} from "./wardrobeServiceTypes.js";

const wardrobeJobs = new Map();

function withDefault<T>(value: T | undefined, defaultValue: T) {
  return value === undefined ? defaultValue : value;
}

function createWardrobeServiceDeps(
  options: WardrobeServiceDependencies,
): WardrobeServiceRuntimeDeps {
  return {
    getProfileImpl: withDefault(options.getProfileImpl, getProfile),
    getCapsuleImpl: withDefault(options.getCapsuleImpl, getCapsule),
    renameCapsuleImpl: withDefault(options.renameCapsuleImpl, renameCapsule),
    updateCapsuleSnapshotImpl: withDefault(
      options.updateCapsuleSnapshotImpl,
      updateCapsuleSnapshot,
    ),
    generateCapsuleWardrobeImpl: withDefault(
      options.generateCapsuleWardrobeImpl,
      generateCapsuleWardrobe,
    ),
    shouldGenerateSwimwearImpl: withDefault(
      options.shouldGenerateSwimwearImpl,
      shouldGenerateSwimwear,
    ),
    generateSwimwearAdditionImpl: withDefault(
      options.generateSwimwearAdditionImpl,
      generateSwimwearAddition,
    ),
    getPartialRegenerationJobImpl: withDefault(
      options.getPartialRegenerationJobImpl,
      (email, capsuleId) => getPartialRegenerationJob(email, capsuleId),
    ),
    buildCapsuleEventSnapshotImpl: withDefault(
      options.buildCapsuleEventSnapshotImpl,
      buildCapsuleEventSnapshot,
    ),
    publishSnapshotImpl: withDefault(
      options.publishSnapshotImpl,
      (email, capsuleId, snapshot) =>
        capsuleEventHub.publish(email, capsuleId, snapshot),
    ),
    jobs: withDefault(options.jobs, wardrobeJobs),
    nowMsImpl: withDefault(options.nowMsImpl, () => Date.now()),
    setTimeoutImpl: withDefault(options.setTimeoutImpl, setTimeout),
    randomUuidImpl: withDefault(options.randomUuidImpl, () =>
      crypto.randomUUID(),
    ),
  };
}

export function createWardrobeService(
  options: WardrobeServiceDependencies = {},
) {
  const deps = createWardrobeServiceDeps(options);
  const getWardrobeJob = (email: string, capsuleId: string) =>
    getWardrobeJobForService(deps, email, capsuleId);
  const startWardrobeJobFromInput = (input) =>
    startWardrobeJobForService(deps, input);
  const startWardrobeJob = (
    ...args: [
      string,
      string,
      Awaited<ReturnType<typeof getProfile>>,
      Awaited<ReturnType<typeof getCapsule>>,
      unknown?,
      StartWardrobeJobOptions?,
    ]
  ) => {
    const [
      email,
      capsuleId,
      profile,
      capsule,
      logContext = null,
      startOptions = {},
    ] = args;
    return startWardrobeJobForService(deps, {
      email,
      capsuleId,
      profile,
      capsule,
      logContext,
      options: startOptions,
    });
  };

  return {
    getCapsuleItems: createGetCapsuleItems(deps, getWardrobeJob),
    getWardrobeJob,
    regenerateCapsuleWardrobe: createRegenerateCapsuleWardrobe(
      deps,
      getWardrobeJob,
      startWardrobeJobFromInput,
    ),
    startWardrobeJob,
  };
}
