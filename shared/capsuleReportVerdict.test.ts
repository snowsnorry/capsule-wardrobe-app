import { describe, expect, test } from "vitest";
import {
  getCapsuleReportVerdictStatusForScore,
  getCapsuleReportVerdictToneForScore,
  normalizeCapsuleReportForDisplay,
  normalizeCapsuleReportVerdictForDisplay,
} from "./capsuleReportVerdict.js";

describe("capsule report verdict mapping", () => {
  test.each([
    [0, "incomplete"],
    [0.39, "incomplete"],
    [0.4, "off_target"],
    [0.59, "off_target"],
    [0.6, "usable_with_gaps"],
    [0.74, "usable_with_gaps"],
    [0.75, "good"],
    [0.89, "good"],
    [0.9, "excellent"],
    [1, "excellent"],
  ] as const)("maps score %s to %s", (score, status) => {
    expect(getCapsuleReportVerdictStatusForScore(score)).toBe(status);
  });

  test("uses low score LLM incomplete or incoherent status when available", () => {
    expect(getCapsuleReportVerdictStatusForScore(0.25, "incomplete")).toBe(
      "incomplete",
    );
    expect(getCapsuleReportVerdictStatusForScore(0.25, "incoherent")).toBe(
      "incoherent",
    );
    expect(getCapsuleReportVerdictStatusForScore(0.25, "good")).toBe(
      "incomplete",
    );
  });

  test("maps status bands to display tones", () => {
    expect(getCapsuleReportVerdictToneForScore(null)).toBe("neutral");
    expect(getCapsuleReportVerdictToneForScore(0.9)).toBe("success");
    expect(getCapsuleReportVerdictToneForScore(0.75)).toBe("success");
    expect(getCapsuleReportVerdictToneForScore(0.6)).toBe("warning");
    expect(getCapsuleReportVerdictToneForScore(0.59)).toBe("error");
    expect(getCapsuleReportVerdictToneForScore(0.2, "incoherent")).toBe(
      "error",
    );
  });

  test("normalizes legacy verdicts without mutating the input", () => {
    const verdict = { score: 0.38, status: "incoherent", summary: "Weak." };
    const normalized = normalizeCapsuleReportVerdictForDisplay(verdict);

    expect(normalized).toEqual({
      llmStatus: "incoherent",
      score: 0.38,
      status: "incoherent",
      summary: "Weak.",
    });
    expect(verdict).toEqual({
      score: 0.38,
      status: "incoherent",
      summary: "Weak.",
    });
  });

  test("normalizes full reports without mutating the input", () => {
    const report = {
      verdict: { score: 0.5, status: "excellent", summary: "Strong." },
    };

    expect(normalizeCapsuleReportForDisplay(report)).toEqual({
      verdict: {
        llmStatus: "excellent",
        score: 0.5,
        status: "off_target",
        summary: "Strong.",
      },
    });
    expect(report).toEqual({
      verdict: { score: 0.5, status: "excellent", summary: "Strong." },
    });
  });
});
