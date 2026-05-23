import {
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
} from "./serverRouteTestConstants.js";

export function createAuthDependencies() {
  return {
    createPendingCodeImpl: async () => ({ ok: true, code: "654321" }),
    verifyCodeImpl: async () => ({ ok: true }),
    createSessionImpl: async (email: string) => ({
      sessionId: SESSION_ID,
      session: {
        email,
        csrfToken: CSRF_TOKEN,
        createdAt: new Date(0).toISOString(),
        expiresAt: new Date(60_000).toISOString(),
      },
    }),
    getSessionImpl: async (sessionId) =>
      sessionId === SESSION_ID
        ? {
            email: "person@example.com",
            csrfToken: CSRF_TOKEN,
            createdAt: new Date(0).toISOString(),
            expiresAt: new Date(60_000).toISOString(),
          }
        : null,
    revokeSessionImpl: async () => {},
    sendLoginCodeEmailImpl: async () => {},
  };
}

export function createPasskeyDependencies() {
  return {
    listPasskeysImpl: async () => [],
    insertPasskeyImpl: async (_payload) => ({
      id: "passkey-1",
      profileEmail: "person@example.com",
      credentialId: "credential-1",
      credentialPublicKey: "public-key",
      counter: 0,
      deviceType: "multiDevice",
      backedUp: true,
      transports: ["internal"],
      name: "Passkey",
      aaguid: null,
      lastUsedAt: null,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    getPasskeyByCredentialIdImpl: async (credentialId) =>
      credentialId === "credential-1"
        ? {
            id: "passkey-1",
            profileEmail: "person@example.com",
            credentialId: "credential-1",
            credentialPublicKey:
              Buffer.from("public-key").toString("base64url"),
            counter: 0,
            deviceType: "multiDevice",
            backedUp: true,
            transports: ["internal"],
            name: "Passkey",
            aaguid: null,
            lastUsedAt: null,
            createdAt: new Date(0).toISOString(),
            updatedAt: new Date(0).toISOString(),
          }
        : null,
    updatePasskeyAuthenticationImpl: async () => null,
    deletePasskeyByIdForEmailImpl: async () => true,
    insertPasskeyChallengeImpl: async () => {},
    consumePasskeyChallengeImpl: async () => null,
    pruneExpiredPasskeyChallengesImpl: async () => {},
    generateRegistrationOptionsImpl: async () => ({
      rp: { name: "Capsule Wardrobe", id: "localhost" },
      user: {
        id: "person@example.com",
        name: "person@example.com",
        displayName: "person@example.com",
      },
      challenge: "registration-challenge",
      pubKeyCredParams: [],
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
      },
    }),
    verifyRegistrationResponseImpl: async () => ({
      verified: true,
      registrationInfo: {
        credential: {
          id: "credential-1",
          publicKey: new Uint8Array([1, 2, 3]),
          counter: 1,
          transports: ["internal"],
        },
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
      },
    }),
    generateAuthenticationOptionsImpl: async () => ({
      challenge: "authentication-challenge",
      rpId: "localhost",
      userVerification: "required",
    }),
    verifyAuthenticationResponseImpl: async () => ({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-1",
        newCounter: 2,
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: TEST_CLIENT_ORIGIN,
        rpID: "localhost",
      },
    }),
  };
}
