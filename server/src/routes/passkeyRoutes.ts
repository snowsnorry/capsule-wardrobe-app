import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { PASSKEY_CHALLENGE_TTL_MS } from "../appConfig.js";
import {
  clearPasskeyChallengeCookie,
  setCsrfCookie,
  setPasskeyChallengeCookie,
  setSessionCookie,
} from "../httpCookies.js";
import {
  getDefaultPasskeyName,
  normalizePasskeyAaguid,
} from "../passkeyNames.js";
import { logError } from "../logger.js";
import {
  generatePasskeyChallengeId,
  getPasskeyChallengeId,
  isAuthenticationResponse,
  isRegistrationResponse,
  publicKeyToBase64Url,
  toPasskeyMetadata,
  toWebAuthnCredential,
  type PasskeyChallengeKind,
  type PasskeyChallengeRecord,
  type PasskeyRecord,
} from "../passkeyHttp.js";
import { registerPasskeyDeleteRoute } from "./passkeyDeleteRoute.js";

export function registerPasskeyRoutes(app, context) {
  registerPasskeyListRoute(app, context);
  registerPasskeyRegistrationRoutes(app, context);
  registerPasskeyAuthenticationRoutes(app, context);
  registerPasskeyDeleteRoute(app, context);
}

function registerPasskeyListRoute(app, context) {
  const { listPasskeysImpl, requireAuth } = context;

  app.get("/auth/passkeys", requireAuth, async (req, res) => {
    try {
      const passkeys = await listPasskeysImpl(req.user.email);
      return res.json({ ok: true, passkeys: passkeys.map(toPasskeyMetadata) });
    } catch (error) {
      logError("[auth/passkeys/list]", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  });
}

function registerPasskeyRegistrationRoutes(app, context) {
  registerPasskeyRegistrationOptionsRoute(app, context);
  registerPasskeyRegistrationVerifyRoute(app, context);
}

function registerPasskeyRegistrationOptionsRoute(app, context) {
  const {
    generateRegistrationOptionsImpl,
    insertPasskeyChallengeImpl,
    listPasskeysImpl,
    nodeEnv,
    passkeyRegisterOptionsLimiter,
    passkeyRpId,
    passkeyRpName,
    pruneExpiredPasskeyChallengesImpl,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
  } = context;

  app.post(
    "/auth/passkeys/register/options",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    passkeyRegisterOptionsLimiter,
    async (req, res) => {
      try {
        await pruneExpiredPasskeyChallengesImpl();
        const existingPasskeys = await listPasskeysImpl(req.user.email);
        const options = await generateRegistrationOptionsImpl({
          rpName: passkeyRpName,
          rpID: passkeyRpId,
          userName: req.user.email,
          userDisplayName: req.user.email,
          userID: new TextEncoder().encode(req.user.email),
          attestationType: "none",
          supportedAlgorithmIDs: [-7, -257],
          excludeCredentials: existingPasskeys.map(toExcludedPasskeyCredential),
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
          },
        });
        const challengeId = generatePasskeyChallengeId();
        await insertPasskeyChallengeImpl({
          id: challengeId,
          kind: "registration",
          challenge: options.challenge,
          profileEmail: req.user.email,
          expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
        });
        setPasskeyChallengeCookie(res, challengeId, nodeEnv);
        return res.json({ ok: true, options });
      } catch (error) {
        logError("[auth/passkeys/register/options]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerPasskeyRegistrationVerifyRoute(app, context) {
  const {
    consumePasskeyChallengeImpl,
    insertPasskeyImpl,
    nodeEnv,
    passkeyOrigin,
    passkeyRpId,
    requireAuth,
    requireCsrf,
    requireTrustedOrigin,
    verifyRegistrationResponseImpl,
  } = context;

  app.post(
    "/auth/passkeys/register/verify",
    requireTrustedOrigin,
    requireAuth,
    requireCsrf,
    async (req, res) => {
      const response = req.body?.response;
      if (!isRegistrationResponse(response)) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const challengeId = getPasskeyChallengeId(req);
      if (!challengeId) {
        return res.status(400).json({ error: "passkey_registration_failed" });
      }

      let challenge: PasskeyChallengeRecord | null;
      try {
        challenge = await consumePasskeyChallengeImpl({
          id: challengeId,
          kind: "registration" as PasskeyChallengeKind,
        });
      } catch (error) {
        logError("[auth/passkeys/register/challenge]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
      clearPasskeyChallengeCookie(res, nodeEnv);

      if (!challenge || challenge.profileEmail !== req.user.email) {
        return res.status(400).json({ error: "passkey_registration_failed" });
      }

      let verification;
      try {
        verification = await verifyRegistrationResponseImpl({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: passkeyOrigin,
          expectedRPID: passkeyRpId,
          requireUserVerification: true,
          supportedAlgorithmIDs: [-7, -257],
        });
      } catch (error) {
        logError("[auth/passkeys/register/verify]", error);
        return res.status(400).json({ error: "passkey_registration_failed" });
      }

      if (!hasVerifiedRegistrationInfo(verification)) {
        return res.status(400).json({ error: "passkey_registration_failed" });
      }

      const { aaguid, credential, credentialDeviceType, credentialBackedUp } =
        verification.registrationInfo;
      const normalizedAaguid = normalizePasskeyAaguid(aaguid);
      try {
        const passkey = await insertPasskeyImpl({
          profileEmail: req.user.email,
          credentialId: credential.id,
          credentialPublicKey: publicKeyToBase64Url(credential.publicKey),
          counter: credential.counter,
          deviceType: credentialDeviceType,
          backedUp: credentialBackedUp,
          transports: getCredentialTransports(credential),
          name: getDefaultPasskeyName({
            aaguid: normalizedAaguid,
            userAgent: req.headers["user-agent"],
          }),
          aaguid: normalizedAaguid,
        });
        return res.json({
          ok: true,
          passkey: passkey ? toPasskeyMetadata(passkey) : null,
        });
      } catch (error) {
        logError("[auth/passkeys/register/store]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerPasskeyAuthenticationRoutes(app, context) {
  registerPasskeyAuthenticationOptionsRoute(app, context);
  registerPasskeyAuthenticationVerifyRoute(app, context);
}

function registerPasskeyAuthenticationOptionsRoute(app, context) {
  const {
    generateAuthenticationOptionsImpl,
    insertPasskeyChallengeImpl,
    nodeEnv,
    passkeyAuthenticateOptionsLimiter,
    passkeyRpId,
    pruneExpiredPasskeyChallengesImpl,
    requireTrustedOrigin,
  } = context;

  app.post(
    "/auth/passkeys/authenticate/options",
    requireTrustedOrigin,
    passkeyAuthenticateOptionsLimiter,
    async (_req, res) => {
      try {
        await pruneExpiredPasskeyChallengesImpl();
        const options = await generateAuthenticationOptionsImpl({
          rpID: passkeyRpId,
          userVerification: "required",
        });
        const challengeId = generatePasskeyChallengeId();
        await insertPasskeyChallengeImpl({
          id: challengeId,
          kind: "authentication",
          challenge: options.challenge,
          profileEmail: null,
          expiresAt: new Date(Date.now() + PASSKEY_CHALLENGE_TTL_MS),
        });
        setPasskeyChallengeCookie(res, challengeId, nodeEnv);
        return res.json({ ok: true, options });
      } catch (error) {
        logError("[auth/passkeys/authenticate/options]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function registerPasskeyAuthenticationVerifyRoute(app, context) {
  const {
    consumePasskeyChallengeImpl,
    createSessionImpl,
    getPasskeyByCredentialIdImpl,
    nodeEnv,
    passkeyAuthenticateVerifyLimiter,
    passkeyOrigin,
    passkeyRpId,
    requireTrustedOrigin,
    updatePasskeyAuthenticationImpl,
    verifyAuthenticationResponseImpl,
  } = context;

  app.post(
    "/auth/passkeys/authenticate/verify",
    requireTrustedOrigin,
    passkeyAuthenticateVerifyLimiter,
    async (req, res) => {
      const response = req.body?.response;
      if (!isAuthenticationResponse(response)) {
        return res.status(400).json({ error: "invalid_payload" });
      }

      const challengeId = getPasskeyChallengeId(req);
      if (!challengeId) {
        return res.status(400).json({ error: "passkey_login_failed" });
      }

      let challenge: PasskeyChallengeRecord | null;
      try {
        challenge = await consumePasskeyChallengeImpl({
          id: challengeId,
          kind: "authentication" as PasskeyChallengeKind,
        });
      } catch (error) {
        logError("[auth/passkeys/authenticate/challenge]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
      clearPasskeyChallengeCookie(res, nodeEnv);

      if (!challenge) {
        return res.status(400).json({ error: "passkey_login_failed" });
      }

      let passkey: PasskeyRecord | null;
      try {
        passkey = await getPasskeyByCredentialIdImpl(response.id);
      } catch (error) {
        logError("[auth/passkeys/authenticate/lookup]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
      if (!passkey) {
        return res.status(400).json({ error: "passkey_login_failed" });
      }

      let verification;
      try {
        verification = await verifyAuthenticationResponseImpl({
          response,
          expectedChallenge: challenge.challenge,
          expectedOrigin: passkeyOrigin,
          expectedRPID: passkeyRpId,
          credential: toWebAuthnCredential(passkey),
          requireUserVerification: true,
        });
      } catch (error) {
        logError("[auth/passkeys/authenticate/verify]", error);
        return res.status(400).json({ error: "passkey_login_failed" });
      }

      if (!verification.verified) {
        return res.status(400).json({ error: "passkey_login_failed" });
      }

      try {
        await updatePasskeyAuthenticationImpl({
          credentialId: passkey.credentialId,
          counter: verification.authenticationInfo.newCounter,
          deviceType: verification.authenticationInfo.credentialDeviceType,
          backedUp: verification.authenticationInfo.credentialBackedUp,
        });
        const { sessionId, session } = await createSessionImpl(
          passkey.profileEmail,
        );
        setSessionCookie(res, sessionId, nodeEnv);
        setCsrfCookie(res, session.csrfToken, nodeEnv);
        return res.json({ ok: true, user: { email: passkey.profileEmail } });
      } catch (error) {
        logError("[auth/passkeys/authenticate/session]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}

function toExcludedPasskeyCredential(passkey): {
  id: string;
  transports: AuthenticatorTransportFuture[];
} {
  return {
    id: passkey.credentialId,
    transports: Array.isArray(passkey.transports)
      ? (passkey.transports as AuthenticatorTransportFuture[])
      : [],
  };
}

function hasVerifiedRegistrationInfo(verification): boolean {
  return Boolean(verification.verified && verification.registrationInfo);
}

function getCredentialTransports(credential): AuthenticatorTransportFuture[] {
  return Array.isArray(credential.transports) ? credential.transports : [];
}
