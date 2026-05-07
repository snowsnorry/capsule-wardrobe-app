import { beforeEach, describe, expect, test, vi } from "vitest";

const requestApi = vi.hoisted(() => ({
  requestJson: vi.fn(),
}));

vi.mock("./request", () => requestApi);
vi.mock("./config", () => ({
  API_BASE_URL: "https://api.example.test",
}));

import {
  deletePasskey,
  getPasskeyAuthenticationOptions,
  getPasskeyRegistrationOptions,
  listPasskeys,
  verifyPasskeyAuthentication,
  verifyPasskeyRegistration,
} from "./passkeys";

describe("passkeys api", () => {
  beforeEach(() => {
    requestApi.requestJson.mockReset();
    requestApi.requestJson.mockResolvedValue({});
  });

  test("management endpoints use authenticated request contracts", async () => {
    await listPasskeys();
    await getPasskeyRegistrationOptions();
    await verifyPasskeyRegistration({ id: "credential-id" });
    await deletePasskey("passkey 1");

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/auth/passkeys",
      { credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/auth/passkeys/register/options",
      { method: "POST", credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      3,
      "https://api.example.test/auth/passkeys/register/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response: { id: "credential-id" } }),
      },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      4,
      "https://api.example.test/auth/passkeys/passkey%201",
      { method: "DELETE", credentials: "include" },
    );
  });

  test("authentication endpoints use public login request contracts", async () => {
    await getPasskeyAuthenticationOptions();
    await verifyPasskeyAuthentication({ id: "credential-id" });

    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      1,
      "https://api.example.test/auth/passkeys/authenticate/options",
      { method: "POST", credentials: "include" },
    );
    expect(requestApi.requestJson).toHaveBeenNthCalledWith(
      2,
      "https://api.example.test/auth/passkeys/authenticate/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ response: { id: "credential-id" } }),
      },
    );
  });
});
