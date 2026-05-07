import { describe, expect, test, vi } from "vitest";
import { resolveAppErrorMessage } from "./errorMessages";

describe("errorMessages", () => {
  test("maps known app error codes to localized keys", () => {
    const t = vi.fn((key: string) => key);

    expect(resolveAppErrorMessage({ message: "invalid_email" }, t)).toBe("errors.invalidEmail");
    expect(resolveAppErrorMessage({ message: "passkey_failed" }, t)).toBe("errors.passkeyLoginFailed");
    expect(t).toHaveBeenCalledWith("errors.invalidEmail");
  });

  test("suppresses passkey cancellation and falls back for unknown errors", () => {
    const t = vi.fn((key: string) => key);

    expect(resolveAppErrorMessage({ message: "passkey_cancelled" }, t)).toBe("");
    expect(resolveAppErrorMessage({ message: "unexpected" }, t)).toBe("errors.generic");
    expect(resolveAppErrorMessage(null, t)).toBe("errors.generic");
  });
});
