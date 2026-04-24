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
});
