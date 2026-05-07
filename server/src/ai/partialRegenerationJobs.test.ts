import { test, expect } from "vitest";
import {
  createPartialRegenerationJobKey,
  getPartialRegenerationJobFromStore
} from "./partialRegenerationJobs.js";
import { buildPartialRegenerationJobState } from "../test/domainFixtures.js";

test("createPartialRegenerationJobKey normalizes email and preserves capsule id", () => {
  expect(createPartialRegenerationJobKey(" Person@Example.COM ", " capsule-1 ")).toBe("person@example.com::capsule-1");
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

  expect(getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "capsule-1",
      jobs,
      nowMs: 1000,
      completedJobTtlMs: 500
    })?.status).toBe("pending");
  expect(getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "capsule-2",
      jobs,
      nowMs: 2000,
      completedJobTtlMs: 500
    })).toBe(null);
  expect(jobs.has("person@example.com::capsule-2")).toBe(false);
});
