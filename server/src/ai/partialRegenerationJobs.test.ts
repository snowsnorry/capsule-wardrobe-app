import { expect, test } from "vitest";
import {
  clearPartialRegenerationJobsForEmail,
  createPartialRegenerationJobKey,
  getPartialRegenerationJobFromStore,
  partialRegenerationJobs,
} from "./partialRegenerationJobs.js";
import type { PartialRegenerationJobState } from "./types.js";

function createJob(overrides = {}) {
  return {
    status: "completed",
    updatedAt: 1_000,
    promise: Promise.resolve(),
    ...overrides,
  } as PartialRegenerationJobState;
}

test("partial regeneration job keys normalize profile email and capsule id", () => {
  expect(
    createPartialRegenerationJobKey(" PERSON@Example.COM ", " cap-1 "),
  ).toBe("person@example.com::cap-1");
  expect(createPartialRegenerationJobKey(" PERSON@Example.COM ", " ")).toBe(
    "person@example.com",
  );
});

test("partial regeneration job store preserves active jobs and expires stale terminal jobs", () => {
  const jobs = new Map<string, PartialRegenerationJobState>();
  jobs.set("person@example.com::active", createJob({ status: "pending" }));
  jobs.set("person@example.com::fresh", createJob({ updatedAt: 1_900 }));
  jobs.set("person@example.com::stale", createJob({ updatedAt: 500 }));

  expect(
    getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "active",
      jobs,
      nowMs: 2_000,
      completedJobTtlMs: 1,
    }),
  ).toMatchObject({ status: "pending" });
  expect(
    getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "fresh",
      jobs,
      nowMs: 2_000,
      completedJobTtlMs: 200,
    }),
  ).toMatchObject({ status: "completed" });
  expect(
    getPartialRegenerationJobFromStore({
      email: "person@example.com",
      capsuleId: "stale",
      jobs,
      nowMs: 2_000,
      completedJobTtlMs: 200,
    }),
  ).toBeNull();
  expect(jobs.has("person@example.com::stale")).toBe(false);
});

test("clearPartialRegenerationJobsForEmail removes only matching profile-owned jobs", () => {
  partialRegenerationJobs.clear();
  partialRegenerationJobs.set("person@example.com", createJob());
  partialRegenerationJobs.set("person@example.com::cap-1", createJob());
  partialRegenerationJobs.set("other@example.com::cap-1", createJob());

  clearPartialRegenerationJobsForEmail(" PERSON@example.com ");

  expect([...partialRegenerationJobs.keys()]).toEqual([
    "other@example.com::cap-1",
  ]);
  clearPartialRegenerationJobsForEmail("");
  expect([...partialRegenerationJobs.keys()]).toEqual([
    "other@example.com::cap-1",
  ]);
});
