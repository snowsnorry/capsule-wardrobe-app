import { describe, expect, test } from "vitest";
import {
  getOutfitReportVerdictStatusForScore,
  getOutfitReportVerdictToneForScore,
  normalizeOutfitReportForDisplay,
  normalizeOutfitReportVerdictForDisplay,
} from "./outfitReportVerdict.js";

describe("outfit report verdict mapping", () => {
  test.each([
    [0, "incomplete"],
    [0.59, "incomplete"],
    [0.6, "acceptable_with_notes"],
    [0.74, "acceptable_with_notes"],
    [0.75, "valid"],
    [0.9, "valid"],
    [1, "valid"],
  ] as const)("maps score %s to %s", (score, status) => {
    expect(getOutfitReportVerdictStatusForScore(score)).toBe(status);
  });

  test("uses low score LLM incomplete or incoherent status when available", () => {
    expect(getOutfitReportVerdictStatusForScore(0.5, "incomplete")).toBe(
      "incomplete",
    );
    expect(getOutfitReportVerdictStatusForScore(0.5, "incoherent")).toBe(
      "incoherent",
    );
    expect(getOutfitReportVerdictStatusForScore(0.5, "valid")).toBe(
      "incomplete",
    );
  });

  test("maps status bands to display tones", () => {
    expect(getOutfitReportVerdictToneForScore(null)).toBe("neutral");
    expect(getOutfitReportVerdictToneForScore(0.75)).toBe("success");
    expect(getOutfitReportVerdictToneForScore(0.6)).toBe("warning");
    expect(getOutfitReportVerdictToneForScore(0.59)).toBe("error");
    expect(getOutfitReportVerdictToneForScore(0.5, "incoherent")).toBe("error");
  });

  test("normalizes legacy verdicts without mutating the input", () => {
    const verdict = { score: 0.5, status: "valid", summary: "Weak." };
    const normalized = normalizeOutfitReportVerdictForDisplay(verdict);

    expect(normalized).toEqual({
      llmStatus: "valid",
      score: 0.5,
      status: "incomplete",
      summary: "Weak.",
    });
    expect(verdict).toEqual({
      score: 0.5,
      status: "valid",
      summary: "Weak.",
    });
  });

  test("normalizes full reports without mutating the input", () => {
    const report = {
      verdict: { score: 0.5, status: "incoherent", summary: "Conflicts." },
    };

    expect(normalizeOutfitReportForDisplay(report)).toEqual({
      verdict: {
        llmStatus: "incoherent",
        score: 0.5,
        status: "incoherent",
        summary: "Conflicts.",
      },
    });
    expect(report).toEqual({
      verdict: { score: 0.5, status: "incoherent", summary: "Conflicts." },
    });
  });
});
