import { API_BASE_URL } from "./config";
import { requestJson } from "./request";
import type { JsonObject } from "./request";

type PasskeyResponse = JsonObject;

async function listPasskeys(): Promise<PasskeyResponse> {
  return requestJson(`${API_BASE_URL}/auth/passkeys`, {
    credentials: "include",
  });
}

async function getPasskeyRegistrationOptions(): Promise<PasskeyResponse> {
  return requestJson(`${API_BASE_URL}/auth/passkeys/register/options`, {
    method: "POST",
    credentials: "include",
  });
}

async function verifyPasskeyRegistration(
  response: unknown,
): Promise<PasskeyResponse> {
  return requestJson(`${API_BASE_URL}/auth/passkeys/register/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ response }),
  });
}

async function getPasskeyAuthenticationOptions(): Promise<PasskeyResponse> {
  return requestJson(`${API_BASE_URL}/auth/passkeys/authenticate/options`, {
    method: "POST",
    credentials: "include",
  });
}

async function verifyPasskeyAuthentication(
  response: unknown,
): Promise<PasskeyResponse> {
  return requestJson(`${API_BASE_URL}/auth/passkeys/authenticate/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ response }),
  });
}

async function deletePasskey(id: string): Promise<PasskeyResponse> {
  return requestJson(
    `${API_BASE_URL}/auth/passkeys/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      credentials: "include",
    },
  );
}

export {
  listPasskeys,
  getPasskeyRegistrationOptions,
  verifyPasskeyRegistration,
  getPasskeyAuthenticationOptions,
  verifyPasskeyAuthentication,
  deletePasskey,
};
