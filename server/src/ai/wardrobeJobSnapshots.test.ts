import { test, expect, vi } from "vitest";
import {
  publishWardrobeSnapshot,
  updateWardrobeCapsuleSnapshot,
} from "./wardrobeJobSnapshots.js";
import {
  buildCapsuleSnapshot,
  buildNormalizedCapsuleRecord,
  buildStoredWardrobePayload,
} from "../test/domainFixtures.js";

test("publishWardrobeSnapshot publishes the active job event snapshot", () => {
  const capsule = buildNormalizedCapsuleRecord();
  const job = { status: "pending" };
  const eventSnapshot = { capsuleId: capsule.id, activeJob: job };
  const deps = {
    buildCapsuleEventSnapshotImpl: vi.fn(() => eventSnapshot),
    publishSnapshotImpl: vi.fn(),
  };

  publishWardrobeSnapshot(
    deps,
    "person@example.com",
    "capsule-1",
    capsule,
    job,
  );

  expect(deps.buildCapsuleEventSnapshotImpl).toHaveBeenCalledWith({
    capsule,
    activeJob: job,
  });
  expect(deps.publishSnapshotImpl).toHaveBeenCalledWith(
    "person@example.com",
    "capsule-1",
    eventSnapshot,
  );
});

test("updateWardrobeCapsuleSnapshot returns a draft capsule when there is no capsule id", async () => {
  const capsule = buildNormalizedCapsuleRecord({ id: "" });
  const baseSnapshot = buildCapsuleSnapshot({
    filters: { season: ["summer"] },
  });
  const payload = buildStoredWardrobePayload();
  const updateCapsuleSnapshotImpl = vi.fn();

  const result = await updateWardrobeCapsuleSnapshot({
    deps: { updateCapsuleSnapshotImpl } as never,
    email: "person@example.com",
    capsuleId: "",
    capsule,
    baseSnapshot,
    payload,
  });

  expect(updateCapsuleSnapshotImpl).not.toHaveBeenCalled();
  expect(result).toEqual({
    ...capsule,
    draft: {
      filters: baseSnapshot.filters,
      data: {
        wardrobe: payload,
        rejectedUrls: [],
        regeneration: null,
      },
    },
  });
});
