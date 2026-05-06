import test from "node:test";
import assert from "node:assert/strict";
import {
  createPartialRegenerationJobKey,
  getPartialRegenerationJobFromStore
} from "./partialRegenerationJobs.js";
import { buildPartialRegenerationJobState } from "../test/domainFixtures.js";

test("createPartialRegenerationJobKey normalizes email and preserves capsule id", () => {
  assert.equal(
    createPartialRegenerationJobKey(" Person@Example.COM ", " capsule-1 "),
    "person@example.com::capsule-1"
  );
});

test("getPartialRegenerationJobFromStore returns pending jobs and clears expired finished jobs", () => {
  const jobs = new Map([
    ["person@example.com::capsule-1", buildPartialRegenerationJobState({
      status: "pending",
      updatedAt: 1000
    })],
    ["person@example.com::capsule-2", buildPartialRegenerationJobState({
      status: "completed",
      updatedAt: 1000
    })]
  ]);

  assert.equal(
    getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "capsule-1",
      jobs,
      nowMs: 1000,
      completedJobTtlMs: 500
    })?.status,
    "pending"
  );
  assert.equal(
    getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "capsule-2",
      jobs,
      nowMs: 2000,
      completedJobTtlMs: 500
    }),
    null
  );
  assert.equal(jobs.has("person@example.com::capsule-2"), false);
});
