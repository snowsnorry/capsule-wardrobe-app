import { describe, expect, test } from "vitest";
import { createCapsuleReportServiceDeps } from "./capsuleReportServiceDeps.js";

describe("createCapsuleReportServiceDeps", () => {
  test("preserves default implementations when overrides are undefined", () => {
    const deps = createCapsuleReportServiceDeps({
      getCapsuleImpl: undefined,
      getProfileImpl: undefined,
    });

    expect(deps.getCapsuleImpl).toBeTypeOf("function");
    expect(deps.getProfileImpl).toBeTypeOf("function");
  });
});
