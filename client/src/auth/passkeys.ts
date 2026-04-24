import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration
} from "@simplewebauthn/browser";
import {
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration
} from "../api/passkeys";
import type { JsonObject } from "../api/request";

type PasskeyFlowResult = JsonObject;
type PasskeyFlowError = Error & {
  code?: string;
};

function isPasskeySupported(): boolean {
  return browserSupportsWebAuthn();
}

function normalizePasskeyError(error: unknown): PasskeyFlowError {
  const name = error && typeof error === "object" ? String((error as { name?: unknown }).name || "") : "";
  const message = error instanceof Error ? error.message : String(error || "");
  const normalized = new Error(message || "passkey_failed") as PasskeyFlowError;

  if (name === "NotAllowedError" || name === "AbortError") {
    normalized.code = "passkey_cancelled";
    normalized.message = "passkey_cancelled";
    return normalized;
  }

  if (message === "passkey_login_failed" || message === "passkey_registration_failed") {
    normalized.code = message;
    normalized.message = message;
    return normalized;
  }

  normalized.code = "passkey_failed";
  normalized.message = "passkey_failed";
  return normalized;
}

async function registerPasskey(): Promise<PasskeyFlowResult> {
  if (!isPasskeySupported()) {
    const error = new Error("passkey_not_supported") as PasskeyFlowError;
    error.code = "passkey_not_supported";
    throw error;
  }

  try {
    const optionsResponse = await getPasskeyRegistrationOptions();
    const attestationResponse = await startRegistration({
      optionsJSON: optionsResponse.options as never
    });
    return verifyPasskeyRegistration(attestationResponse);
  } catch (error) {
    throw normalizePasskeyError(error);
  }
}

async function authenticateWithPasskey(): Promise<PasskeyFlowResult> {
  if (!isPasskeySupported()) {
    const error = new Error("passkey_not_supported") as PasskeyFlowError;
    error.code = "passkey_not_supported";
    throw error;
  }

  try {
    const optionsResponse = await getPasskeyAuthenticationOptions();
    const assertionResponse = await startAuthentication({
      optionsJSON: optionsResponse.options as never
    });
    return verifyPasskeyAuthentication(assertionResponse);
  } catch (error) {
    throw normalizePasskeyError(error);
  }
}

export {
  authenticateWithPasskey,
  isPasskeySupported,
  normalizePasskeyError,
  registerPasskey
};
export type { PasskeyFlowError, PasskeyFlowResult };
