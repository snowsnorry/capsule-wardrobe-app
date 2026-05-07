export type DependencyOverrides = Record<string, unknown>;
export type StartedTestServer = {
  deps: Record<string, unknown>;
  baseUrl: string;
};
export type CleanupContext = {
  after?: (cleanup: () => Promise<void>) => void;
  onTestFinished?: (cleanup: () => Promise<void>) => void;
};
export type RequestJsonOptions = {
  method?: string;
  body?: unknown;
  cookie?: string;
  csrfToken?: string;
  origin?: string;
  headers?: Record<string, string>;
};
export type RequestJsonResult = {
  response: Response;
  json: TestResponseJson;
};
export type MutableRecord = Record<string, unknown>;
export type TestResponseJson = MutableRecord & {
  error?: string;
  ok?: boolean;
  capsuleId?: string;
  name?: string;
  options?: MutableRecord & {
    challenge?: string;
    userVerification?: string;
    authenticatorSelection?: MutableRecord & {
      userVerification?: string;
    };
  };
  passkey?: MutableRecord;
  passkeys?: MutableRecord[];
  profile?: MutableRecord & {
    audience?: unknown;
  };
  snapshot?: MutableRecord;
};
export type PasskeyInsertPayload = MutableRecord & {
  profileEmail: string;
  credentialId: string;
  aaguid: string | null;
  name: string;
};
export type PasskeyChallengePayload = MutableRecord & {
  id: string;
  kind: string;
  profileEmail?: string | null;
};
export type RegistrationOptionsInput = MutableRecord & {
  authenticatorSelection: MutableRecord & {
    userVerification?: string;
  };
};
export type AuthenticationOptionsInput = MutableRecord & {
  userVerification?: string;
};
export type WebAuthnVerifyInput = MutableRecord & {
  requireUserVerification?: boolean;
  response: MutableRecord & {
    response: MutableRecord;
  };
};
