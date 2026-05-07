process.env.NODE_ENV = "test";

export {
  AUTH_COOKIE,
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
} from "./serverRouteTestConstants.js";
export {
  passkeyAuthenticationResponse,
  passkeyRegistrationResponse,
} from "./serverRouteTestPasskeys.js";
export { requestJson, requestText } from "./serverRouteTestRequests.js";
export {
  startSpaFallbackTestServer,
  startTestServer,
} from "./serverRouteTestServers.js";

export type {
  AuthenticationOptionsInput,
  MutableRecord,
  PasskeyChallengePayload,
  PasskeyInsertPayload,
  RegistrationOptionsInput,
  WebAuthnVerifyInput,
} from "./serverRouteTestTypes.js";
