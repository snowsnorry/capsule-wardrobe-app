import { describe, expect, test } from "vitest";
import {
  clearOutfitImageJobsForEmail,
  createOutfitImageJobKey,
  deleteOutfitImageJob,
  getOutfitImageJob,
  getOutfitImageJobByKey,
  setPendingOutfitImageJob,
} from "./outfitImageJobs.js";

describe("outfit image job registry", () => {
  test("normalizes job keys and exposes only pending public state", () => {
    const jobKey = createOutfitImageJobKey(" USER@Example.TEST ", " outfit-1 ");

    expect(jobKey).toBe("user@example.test::outfit-1");
    expect(getOutfitImageJob("user@example.test", "outfit-1")).toBeNull();

    setPendingOutfitImageJob(jobKey, { status: "ready" });
    expect(getOutfitImageJobByKey(jobKey)).toEqual({ status: "ready" });
    expect(getOutfitImageJob("user@example.test", "outfit-1")).toBeNull();

    setPendingOutfitImageJob(jobKey, { status: "pending" });
    expect(getOutfitImageJob("user@example.test", "outfit-1")).toEqual({
      status: "pending",
    });

    deleteOutfitImageJob(jobKey);
    expect(getOutfitImageJobByKey(jobKey)).toBeUndefined();
  });

  test("clears only matching email jobs", () => {
    const matchingKey = createOutfitImageJobKey(
      "user@example.test",
      "outfit-1",
    );
    const legacyMatchingKey = "user@example.test";
    const otherKey = createOutfitImageJobKey("other@example.test", "outfit-2");
    setPendingOutfitImageJob(matchingKey, { status: "pending" });
    setPendingOutfitImageJob(legacyMatchingKey, { status: "pending" });
    setPendingOutfitImageJob(otherKey, { status: "pending" });

    clearOutfitImageJobsForEmail("");
    expect(getOutfitImageJobByKey(matchingKey)).toEqual({ status: "pending" });

    clearOutfitImageJobsForEmail(" USER@example.test ");

    expect(getOutfitImageJobByKey(matchingKey)).toBeUndefined();
    expect(getOutfitImageJobByKey(legacyMatchingKey)).toBeUndefined();
    expect(getOutfitImageJobByKey(otherKey)).toEqual({ status: "pending" });

    deleteOutfitImageJob(otherKey);
  });
});
