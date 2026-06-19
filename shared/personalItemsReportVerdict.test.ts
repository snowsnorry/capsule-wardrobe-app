import { describe, expect, test } from "vitest";
import {
  getPersonalItemsReportVerdictStatusForScore,
  getPersonalItemsReportVerdictToneForScore,
  normalizePersonalItemsReportForDisplay,
} from "./personalItemsReportVerdict.js";

describe("personal items report verdict mapping", () => {
  test.each([
    [0.95, "excellent"],
    [0.75, "good"],
    [0.6, "usable_with_gaps"],
    [0.4, "unbalanced"],
    [0.2, "incomplete"],
  ])("maps score %s to %s", (score, status) => {
    expect(getPersonalItemsReportVerdictStatusForScore(score)).toBe(status);
  });

  test("preserves low-score LLM statuses and maps tone", () => {
    expect(getPersonalItemsReportVerdictStatusForScore(0.2, "unclear")).toBe(
      "unclear",
    );
    expect(getPersonalItemsReportVerdictToneForScore(0.9)).toBe("success");
    expect(getPersonalItemsReportVerdictToneForScore(0.6)).toBe("warning");
    expect(getPersonalItemsReportVerdictToneForScore(0.39)).toBe("error");
  });

  test("normalizes full reports without mutating the input", () => {
    const report = {
      verdict: { score: 0.92, status: "good" },
    };

    expect(normalizePersonalItemsReportForDisplay(report)).toEqual({
      verdict: {
        llmStatus: "good",
        score: 0.92,
        status: "excellent",
      },
    });
    expect(report).toEqual({ verdict: { score: 0.92, status: "good" } });
  });
});
