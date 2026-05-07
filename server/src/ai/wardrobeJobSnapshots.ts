import type { WardrobeServiceRuntimeDeps } from "./wardrobeServiceTypes.js";

export function publishWardrobeSnapshot(deps, email, capsuleId, capsule, job) {
  deps.publishSnapshotImpl(
    email,
    capsuleId,
    deps.buildCapsuleEventSnapshotImpl({ capsule, activeJob: job }),
  );
}

function buildWardrobeSnapshot(baseSnapshot, payload) {
  return {
    filters: baseSnapshot?.filters,
    data: {
      wardrobe: payload,
      rejectedUrls: [],
      regeneration: null,
    },
  };
}

export async function updateWardrobeCapsuleSnapshot({
  deps,
  email,
  capsuleId,
  capsule,
  baseSnapshot,
  payload,
}: {
  deps: WardrobeServiceRuntimeDeps;
  email: string;
  capsuleId: string;
  capsule;
  baseSnapshot;
  payload;
}) {
  const snapshot = buildWardrobeSnapshot(baseSnapshot, payload);
  if (capsuleId) {
    return deps.updateCapsuleSnapshotImpl(email, capsuleId, snapshot);
  }

  return {
    ...capsule,
    draft: snapshot,
  };
}
