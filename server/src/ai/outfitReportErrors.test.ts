import { describe, expect, test } from "vitest";
import {
  buildOutfitReportError,
  isOutfitReportDomainError,
} from "./outfitReportErrors.js";

describe("outfitReportErrors", () => {
  test("detects domain errors without throwing on unknown values", () => {
    expect(isOutfitReportDomainError(null)).toBe(false);
    expect(isOutfitReportDomainError(undefined)).toBe(false);
    expect(isOutfitReportDomainError("service_unavailable")).toBe(false);
    expect(isOutfitReportDomainError({ code: "other" })).toBe(false);
    expect(
      isOutfitReportDomainError(buildOutfitReportError("invalid_payload")),
    ).toBe(true);
    expect(isOutfitReportDomainError(buildOutfitReportError("not_found"))).toBe(
      true,
    );
    expect(
      isOutfitReportDomainError(buildOutfitReportError("service_unavailable")),
    ).toBe(true);
  });
});
