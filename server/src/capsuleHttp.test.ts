import { describe, expect, test } from "vitest";
import { toCapsuleResponse } from "./capsuleHttp.js";

describe("capsule HTTP responses", () => {
  test("normalizes legacy capsule report verdicts for display without mutating stored snapshots", () => {
    const report = {
      itemsHash: "hash-1",
      schemaVersion: 1,
      verdict: {
        score: 0.5,
        status: "excellent",
        summary: "The capsule looks strong.",
      },
    };
    const capsule = {
      id: "capsule-1",
      name: "Travel",
      status: "saved",
      draft: {
        filters: {},
        data: { wardrobe: { items: [] } },
        report,
      },
      saved: null,
    };

    const response = toCapsuleResponse(capsule);

    expect(response.draft?.report?.verdict).toEqual({
      llmStatus: "excellent",
      score: 0.5,
      status: "off_target",
      summary: "The capsule looks strong.",
    });
    expect(report.verdict).toEqual({
      score: 0.5,
      status: "excellent",
      summary: "The capsule looks strong.",
    });
  });
});
