import { beforeEach, describe, expect, test, vi } from "vitest";

const simpleWebAuthnMock = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(),
  startAuthentication: vi.fn(),
  startRegistration: vi.fn()
}));
const passkeysApiMock = vi.hoisted(() => ({
  getPasskeyAuthenticationOptions: vi.fn(),
  getPasskeyRegistrationOptions: vi.fn(),
  verifyPasskeyAuthentication: vi.fn(),
  verifyPasskeyRegistration: vi.fn()
}));

vi.mock("@simplewebauthn/browser", () => simpleWebAuthnMock);
vi.mock("../api/passkeys", () => passkeysApiMock);

import {
  authenticateWithPasskey,
  isPasskeySupported,
  normalizePasskeyError,
  registerPasskey
} from "./passkeys";

describe("passkey browser helper", () => {
  beforeEach(() => {
    simpleWebAuthnMock.browserSupportsWebAuthn.mockReset();
    simpleWebAuthnMock.startAuthentication.mockReset();
    simpleWebAuthnMock.startRegistration.mockReset();
    passkeysApiMock.getPasskeyAuthenticationOptions.mockReset();
    passkeysApiMock.getPasskeyRegistrationOptions.mockReset();
    passkeysApiMock.verifyPasskeyAuthentication.mockReset();
    passkeysApiMock.verifyPasskeyRegistration.mockReset();
    simpleWebAuthnMock.browserSupportsWebAuthn.mockReturnValue(true);
    passkeysApiMock.getPasskeyRegistrationOptions.mockResolvedValue({ options: { challenge: "register" } });
    passkeysApiMock.getPasskeyAuthenticationOptions.mockResolvedValue({ options: { challenge: "auth" } });
    simpleWebAuthnMock.startRegistration.mockResolvedValue({ id: "new-credential" });
    simpleWebAuthnMock.startAuthentication.mockResolvedValue({ id: "credential" });
    passkeysApiMock.verifyPasskeyRegistration.mockResolvedValue({ ok: true });
    passkeysApiMock.verifyPasskeyAuthentication.mockResolvedValue({ ok: true });
  });

  test("reports WebAuthn support", () => {
    expect(isPasskeySupported()).toBe(true);
    expect(simpleWebAuthnMock.browserSupportsWebAuthn).toHaveBeenCalledTimes(1);
  });

  test("registerPasskey gets options, starts registration, and verifies response", async () => {
    await registerPasskey();

    expect(simpleWebAuthnMock.startRegistration).toHaveBeenCalledWith({
      optionsJSON: { challenge: "register" }
    });
    expect(passkeysApiMock.verifyPasskeyRegistration).toHaveBeenCalledWith({ id: "new-credential" });
  });

  test("authenticateWithPasskey gets options, starts authentication, and verifies response", async () => {
    await authenticateWithPasskey();

    expect(simpleWebAuthnMock.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: { challenge: "auth" }
    });
    expect(passkeysApiMock.verifyPasskeyAuthentication).toHaveBeenCalledWith({ id: "credential" });
  });

  test("normalizes browser cancellation", async () => {
    simpleWebAuthnMock.startAuthentication.mockRejectedValue(new DOMException("cancelled", "NotAllowedError"));

    await expect(authenticateWithPasskey()).rejects.toMatchObject({
      message: "passkey_cancelled",
      code: "passkey_cancelled"
    });
  });

  test("throws a typed unsupported error before starting flows", async () => {
    simpleWebAuthnMock.browserSupportsWebAuthn.mockReturnValue(false);

    await expect(registerPasskey()).rejects.toMatchObject({
      message: "passkey_not_supported",
      code: "passkey_not_supported"
    });
    await expect(authenticateWithPasskey()).rejects.toMatchObject({
      message: "passkey_not_supported",
      code: "passkey_not_supported"
    });
    expect(simpleWebAuthnMock.startRegistration).not.toHaveBeenCalled();
    expect(simpleWebAuthnMock.startAuthentication).not.toHaveBeenCalled();
  });

  test("normalizes known API errors and unknown values", () => {
    expect(normalizePasskeyError(new Error("passkey_login_failed"))).toMatchObject({
      message: "passkey_login_failed",
      code: "passkey_login_failed"
    });
    expect(normalizePasskeyError(new DOMException("aborted", "AbortError"))).toMatchObject({
      message: "passkey_cancelled",
      code: "passkey_cancelled"
    });
    expect(normalizePasskeyError("boom")).toMatchObject({
      message: "passkey_failed",
      code: "passkey_failed"
    });
  });
});
