process.env.NODE_ENV = "test";

export {
  AUTH_COOKIE,
  CSRF_TOKEN,
  SESSION_ID,
  TEST_CLIENT_ORIGIN,
} from "./serverRouteTestConstants.js";
export { createDependencies } from "./serverRouteTestDependencies.js";
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
  CleanupContext,
  DependencyOverrides,
  MutableRecord,
  PasskeyChallengePayload,
  PasskeyInsertPayload,
  RegistrationOptionsInput,
  RequestJsonOptions,
  RequestJsonResult,
  StartedTestServer,
  TestResponseJson,
  WebAuthnVerifyInput,
} from "./serverRouteTestTypes.js";
