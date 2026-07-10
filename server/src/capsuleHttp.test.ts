import { describe, expect, test } from "vitest";
import { isApiPath, toCapsuleResponse } from "./capsuleHttp.js";

describe("capsule HTTP responses", () => {
  test("classifies integration routes as API paths without matching similar frontend paths", () => {
    expect(isApiPath("/oauth")).toBe(true);
    expect(isApiPath("/oauth/authorize")).toBe(true);
    expect(isApiPath("/.well-known/oauth-protected-resource")).toBe(true);
    expect(isApiPath("/mcp")).toBe(true);
    expect(isApiPath("/mcp/session")).toBe(true);
    expect(isApiPath("/jobs")).toBe(true);
    expect(isApiPath("/jobs/events")).toBe(true);
    expect(isApiPath("/healthall")).toBe(true);
    expect(isApiPath("/healthall/missing")).toBe(true);

    expect(isApiPath("/oauth-return")).toBe(false);
    expect(isApiPath("/mcp-settings")).toBe(false);
    expect(isApiPath("/jobs-dashboard")).toBe(false);
  });

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
      pin: true,
      status: "saved",
      draft: {
        filters: {},
        data: { wardrobe: { items: [] } },
        report,
      },
      saved: null,
    };

    const response = toCapsuleResponse(capsule);

    expect(response.pin).toBe(true);
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
