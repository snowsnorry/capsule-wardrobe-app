import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_COOKIE,
  CSRF_TOKEN,
  TEST_CLIENT_ORIGIN,
  passkeyAuthenticationResponse,
  passkeyRegistrationResponse,
  requestJson,
  startTestServer,
  type AuthenticationOptionsInput,
  type MutableRecord,
  type PasskeyChallengePayload,
  type PasskeyInsertPayload,
  type RegistrationOptionsInput,
  type WebAuthnVerifyInput
} from "../test/serverRouteTestUtils.js";

test("passkey registration routes require auth, store challenge, and save verified passkey", async (t) => {
  let storedChallenge: PasskeyChallengePayload | null = null;
  let insertedPasskey: PasskeyInsertPayload | null = null;
  let challengeConsumeCount = 0;
  let registrationOptionsInput: RegistrationOptionsInput | null = null;
  let registrationVerifyInput: WebAuthnVerifyInput | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generateRegistrationOptionsImpl: async (input) => {
        registrationOptionsInput = input;
        return {
          rp: { name: "Capsule Wardrobe", id: "localhost" },
          user: { id: "person@example.com", name: "person@example.com", displayName: "person@example.com" },
          challenge: "registration-challenge",
          pubKeyCredParams: [],
          authenticatorSelection: { residentKey: "preferred", userVerification: "required" }
        };
      },
      insertPasskeyChallengeImpl: async (input) => {
        storedChallenge = input;
      },
      consumePasskeyChallengeImpl: async ({ id, kind }) => {
        challengeConsumeCount += 1;
        return id === "challenge-1" && kind === "registration"
          ? {
              id,
              kind,
              challenge: "registration-challenge",
              profileEmail: "person@example.com"
            }
          : null;
      },
      insertPasskeyImpl: async (input) => {
        insertedPasskey = input;
        return {
          id: "passkey-1",
          profileEmail: input.profileEmail,
          credentialId: input.credentialId,
          credentialPublicKey: input.credentialPublicKey,
          counter: input.counter,
          deviceType: input.deviceType,
          backedUp: input.backedUp,
          transports: input.transports,
          name: input.name,
          aaguid: input.aaguid,
          lastUsedAt: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        };
      },
      verifyRegistrationResponseImpl: async (input) => {
        registrationVerifyInput = input;
        return {
          verified: true,
          registrationInfo: {
            aaguid: "BADA5566-A7AA-401F-BD96-45619A55120D",
            credential: {
              id: "credential-1",
              publicKey: new Uint8Array([1, 2, 3]),
              counter: 1,
              transports: ["internal"]
            },
            credentialDeviceType: "multiDevice",
            credentialBackedUp: true
          }
        };
      }
    }
  });

  const unauthorized = await requestJson(baseUrl, "/auth/passkeys/register/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN
  });
  assert.equal(unauthorized.response.status, 401);

  const options = await requestJson(baseUrl, "/auth/passkeys/register/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(options.response.status, 200);
  assert.equal(options.json.options.challenge, "registration-challenge");
  assert.equal(options.json.options.authenticatorSelection.userVerification, "required");
  assert.equal(registrationOptionsInput.authenticatorSelection.userVerification, "required");
  assert.equal(storedChallenge.kind, "registration");
  assert.equal(storedChallenge.profileEmail, "person@example.com");
  assert.ok(options.response.headers.get("set-cookie")?.includes("passkey_challenge="));

  const malformed = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: `${AUTH_COOKIE}; passkey_challenge=challenge-1`,
    csrfToken: CSRF_TOKEN,
    body: { response: passkeyRegistrationResponse({ response: { attestationObject: undefined } }) }
  });
  assert.equal(malformed.response.status, 400);
  assert.deepEqual(malformed.json, { error: "invalid_payload" });
  assert.equal(challengeConsumeCount, 0);

  const missingChallenge = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN,
    body: { response: passkeyRegistrationResponse() }
  });
  assert.equal(missingChallenge.response.status, 400);
  assert.deepEqual(missingChallenge.json, { error: "passkey_registration_failed" });

  const verified = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: `${AUTH_COOKIE}; passkey_challenge=challenge-1`,
    csrfToken: CSRF_TOKEN,
    body: {
      response: passkeyRegistrationResponse({
        extraTopLevel: "kept",
        response: { extraNested: "kept" }
      })
    }
  });
  assert.equal(verified.response.status, 200);
  assert.equal(registrationVerifyInput.requireUserVerification, true);
  assert.equal(registrationVerifyInput.response.extraTopLevel, "kept");
  assert.equal(registrationVerifyInput.response.response.extraNested, "kept");
  assert.equal(insertedPasskey.profileEmail, "person@example.com");
  assert.equal(insertedPasskey.credentialId, "credential-1");
  assert.equal(insertedPasskey.aaguid, "bada5566-a7aa-401f-bd96-45619a55120d");
  assert.equal(insertedPasskey.name, "1Password");
  assert.equal(verified.json.passkey.credentialPublicKey, undefined);
  assert.equal(verified.json.passkey.aaguid, undefined);
});

test("passkey registration falls back to user-agent label for unknown AAGUID", async (t) => {
  let insertedPasskey: PasskeyInsertPayload | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      consumePasskeyChallengeImpl: async ({ id, kind }) => (
        id === "challenge-ua" && kind === "registration"
          ? {
              id,
              kind,
              challenge: "registration-challenge",
              profileEmail: "person@example.com"
            }
          : null
      ),
      insertPasskeyImpl: async (input) => {
        insertedPasskey = input;
        return {
          id: "passkey-1",
          profileEmail: input.profileEmail,
          credentialId: input.credentialId,
          credentialPublicKey: input.credentialPublicKey,
          counter: input.counter,
          deviceType: input.deviceType,
          backedUp: input.backedUp,
          transports: input.transports,
          name: input.name,
          aaguid: input.aaguid,
          lastUsedAt: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        };
      },
      verifyRegistrationResponseImpl: async () => ({
        verified: true,
        registrationInfo: {
          aaguid: "11111111-2222-3333-4444-555555555555",
          credential: {
            id: "credential-1",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 1,
            transports: ["internal"]
          },
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true
        }
      })
    }
  });

  const verified = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: `${AUTH_COOKIE}; passkey_challenge=challenge-ua`,
    csrfToken: CSRF_TOKEN,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    },
    body: { response: passkeyRegistrationResponse() }
  });

  assert.equal(verified.response.status, 200);
  assert.equal(insertedPasskey.aaguid, "11111111-2222-3333-4444-555555555555");
  assert.equal(insertedPasskey.name, "Windows Chrome");
});

test("passkey registration falls back to generic name without provider or user-agent label", async (t) => {
  let insertedPasskey: PasskeyInsertPayload | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      consumePasskeyChallengeImpl: async ({ id, kind }) => (
        id === "challenge-fallback" && kind === "registration"
          ? {
              id,
              kind,
              challenge: "registration-challenge",
              profileEmail: "person@example.com"
            }
          : null
      ),
      insertPasskeyImpl: async (input) => {
        insertedPasskey = input;
        return {
          id: "passkey-1",
          profileEmail: input.profileEmail,
          credentialId: input.credentialId,
          credentialPublicKey: input.credentialPublicKey,
          counter: input.counter,
          deviceType: input.deviceType,
          backedUp: input.backedUp,
          transports: input.transports,
          name: input.name,
          aaguid: input.aaguid,
          lastUsedAt: null,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString()
        };
      },
      verifyRegistrationResponseImpl: async () => ({
        verified: true,
        registrationInfo: {
          aaguid: "not-a-guid",
          credential: {
            id: "credential-1",
            publicKey: new Uint8Array([1, 2, 3]),
            counter: 1,
            transports: ["internal"]
          },
          credentialDeviceType: "multiDevice",
          credentialBackedUp: true
        }
      })
    }
  });

  const verified = await requestJson(baseUrl, "/auth/passkeys/register/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: `${AUTH_COOKIE}; passkey_challenge=challenge-fallback`,
    csrfToken: CSRF_TOKEN,
    headers: { "User-Agent": "unknown" },
    body: { response: passkeyRegistrationResponse() }
  });

  assert.equal(verified.response.status, 200);
  assert.equal(insertedPasskey.aaguid, null);
  assert.equal(insertedPasskey.name, "Passkey");
});

test("passkey authentication routes store challenge, reject unknown credentials, and create app session", async (t) => {
  let storedChallenge: PasskeyChallengePayload | null = null;
  let updatedAuth: MutableRecord | null = null;
  let challengeConsumeCount = 0;
  let credentialLookupCount = 0;
  let authenticationOptionsInput: AuthenticationOptionsInput | null = null;
  let authenticationVerifyInput: WebAuthnVerifyInput | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      generateAuthenticationOptionsImpl: async (input) => {
        authenticationOptionsInput = input;
        return {
          challenge: "authentication-challenge",
          rpId: "localhost",
          userVerification: "required"
        };
      },
      insertPasskeyChallengeImpl: async (input) => {
        storedChallenge = input;
      },
      consumePasskeyChallengeImpl: async ({ id, kind }) => {
        challengeConsumeCount += 1;
        return id === "challenge-1" && kind === "authentication"
          ? {
              id,
              kind,
              challenge: "authentication-challenge",
              profileEmail: null
            }
          : null;
      },
      getPasskeyByCredentialIdImpl: async (credentialId) => {
        credentialLookupCount += 1;
        return credentialId === "credential-1"
          ? {
              id: "passkey-1",
              profileEmail: "person@example.com",
              credentialId: "credential-1",
              credentialPublicKey: Buffer.from("public-key").toString("base64url"),
              counter: 0,
              deviceType: "multiDevice",
              backedUp: true,
              transports: ["internal"],
              name: "Passkey",
              lastUsedAt: null,
              createdAt: new Date(0).toISOString(),
              updatedAt: new Date(0).toISOString()
            }
          : null;
      },
      updatePasskeyAuthenticationImpl: async (input) => {
        updatedAuth = input;
        return null;
      },
      verifyAuthenticationResponseImpl: async (input) => {
        authenticationVerifyInput = input;
        return {
          verified: true,
          authenticationInfo: {
            credentialID: "credential-1",
            newCounter: 2,
            userVerified: true,
            credentialDeviceType: "multiDevice",
            credentialBackedUp: true,
            origin: "https://client.example",
            rpID: "localhost"
          }
        };
      }
    }
  });

  const options = await requestJson(baseUrl, "/auth/passkeys/authenticate/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN
  });
  assert.equal(options.response.status, 200);
  assert.equal(options.json.options.challenge, "authentication-challenge");
  assert.equal(options.json.options.userVerification, "required");
  assert.equal(authenticationOptionsInput.userVerification, "required");
  assert.equal(storedChallenge.kind, "authentication");
  assert.equal(storedChallenge.profileEmail, null);
  assert.ok(options.response.headers.get("set-cookie")?.includes("passkey_challenge="));

  const malformed = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-1",
    body: { response: passkeyAuthenticationResponse({ response: { signature: undefined } }) }
  });
  assert.equal(malformed.response.status, 400);
  assert.deepEqual(malformed.json, { error: "invalid_payload" });
  assert.equal(challengeConsumeCount, 0);
  assert.equal(credentialLookupCount, 0);

  const unknown = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-1",
    body: { response: passkeyAuthenticationResponse({ id: "unknown", rawId: "unknown" }) }
  });
  assert.equal(unknown.response.status, 400);
  assert.deepEqual(unknown.json, { error: "passkey_login_failed" });

  const success = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-1",
    body: {
      response: passkeyAuthenticationResponse({
        extraTopLevel: "kept",
        response: { extraNested: "kept" }
      })
    }
  });
  assert.equal(success.response.status, 200);
  assert.deepEqual(success.json, { ok: true, user: { email: "person@example.com" } });
  assert.equal(authenticationVerifyInput.requireUserVerification, true);
  assert.equal(authenticationVerifyInput.response.extraTopLevel, "kept");
  assert.equal(authenticationVerifyInput.response.response.extraNested, "kept");
  assert.equal(updatedAuth.credentialId, "credential-1");
  assert.equal(updatedAuth.counter, 2);
  const setCookie = success.response.headers.get("set-cookie");
  assert.ok(setCookie?.includes("session="));
  assert.ok(setCookie?.includes("csrf="));
});

test("passkey authentication options route is rate limited by IP", async (t) => {
  let challengeInsertCount = 0;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      insertPasskeyChallengeImpl: async () => {
        challengeInsertCount += 1;
      }
    }
  });

  for (let index = 0; index < 20; index += 1) {
    const allowed = await requestJson(baseUrl, "/auth/passkeys/authenticate/options", {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN
    });
    assert.equal(allowed.response.status, 200);
  }

  const limited = await requestJson(baseUrl, "/auth/passkeys/authenticate/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN
  });
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.json, { error: "too_many_requests" });
  assert.equal(challengeInsertCount, 20);
});

test("passkey authentication verify route is rate limited by IP", async (t) => {
  let challengeConsumeCount = 0;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      consumePasskeyChallengeImpl: async () => {
        challengeConsumeCount += 1;
        return null;
      }
    }
  });

  for (let index = 0; index < 30; index += 1) {
    const allowed = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: `passkey_challenge=challenge-${index}`,
      body: { response: passkeyAuthenticationResponse() }
    });
    assert.equal(allowed.response.status, 400);
    assert.deepEqual(allowed.json, { error: "passkey_login_failed" });
  }

  const limited = await requestJson(baseUrl, "/auth/passkeys/authenticate/verify", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: "passkey_challenge=challenge-over-limit",
    body: { response: passkeyAuthenticationResponse() }
  });
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.json, { error: "too_many_requests" });
  assert.equal(challengeConsumeCount, 30);
});

test("passkey registration options route is rate limited by IP after auth and csrf checks", async (t) => {
  let challengeInsertCount = 0;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      insertPasskeyChallengeImpl: async () => {
        challengeInsertCount += 1;
      }
    }
  });

  for (let index = 0; index < 10; index += 1) {
    const allowed = await requestJson(baseUrl, "/auth/passkeys/register/options", {
      method: "POST",
      origin: TEST_CLIENT_ORIGIN,
      cookie: AUTH_COOKIE,
      csrfToken: CSRF_TOKEN
    });
    assert.equal(allowed.response.status, 200);
  }

  const limited = await requestJson(baseUrl, "/auth/passkeys/register/options", {
    method: "POST",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(limited.response.status, 429);
  assert.deepEqual(limited.json, { error: "too_many_requests" });
  assert.equal(challengeInsertCount, 10);
});

test("passkey list and delete routes expose metadata and scope deletion to current user", async (t) => {
  let deleteInput: MutableRecord | null = null;
  const { baseUrl } = await startTestServer(t, {
    overrides: {
      listPasskeysImpl: async () => [{
        id: "passkey-1",
        profileEmail: "person@example.com",
        credentialId: "credential-1",
        credentialPublicKey: "secret-public-key",
        counter: 0,
        deviceType: "multiDevice",
        backedUp: true,
        transports: ["internal"],
        name: "Laptop",
        aaguid: "bada5566-a7aa-401f-bd96-45619a55120d",
        lastUsedAt: null,
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString()
      }],
      deletePasskeyByIdForEmailImpl: async (input) => {
        deleteInput = input;
        return input.email === "person@example.com" && input.passkeyId === "passkey-1";
      }
    }
  });

  const list = await requestJson(baseUrl, "/auth/passkeys", {
    cookie: AUTH_COOKIE
  });
  assert.equal(list.response.status, 200);
  assert.deepEqual(list.json.passkeys[0], {
    id: "passkey-1",
    name: "Laptop",
    deviceType: "multiDevice",
    backedUp: true,
    transports: ["internal"],
    createdAt: new Date(0).toISOString(),
    lastUsedAt: null
  });
  assert.equal(Object.hasOwn(list.json.passkeys[0], "aaguid"), false);

  const deleted = await requestJson(baseUrl, "/auth/passkeys/passkey-1", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(deleted.response.status, 200);
  assert.deepEqual(deleteInput, { email: "person@example.com", passkeyId: "passkey-1" });

  const missing = await requestJson(baseUrl, "/auth/passkeys/other-passkey", {
    method: "DELETE",
    origin: TEST_CLIENT_ORIGIN,
    cookie: AUTH_COOKIE,
    csrfToken: CSRF_TOKEN
  });
  assert.equal(missing.response.status, 404);
});
