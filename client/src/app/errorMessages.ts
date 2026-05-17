const ERROR_MESSAGE_KEYS: Record<string, string> = {
  invalid_email: "errors.invalidEmail",
  cooldown: "errors.cooldown",
  rate_limit: "errors.rateLimit",
  expired: "errors.expired",
  max_attempts: "errors.maxAttempts",
  invalid: "errors.invalidCode",
  profile_exists: "errors.profileExists",
  not_found: "errors.profileNotFound",
  invalid_payload: "errors.invalidPayload",
  invalid_google_token: "errors.invalidGoogleToken",
  google_auth_not_configured: "errors.googleAuthNotConfigured",
  passkey_not_supported: "errors.passkeyNotSupported",
  passkey_registration_failed: "errors.passkeySetupFailed",
  passkey_login_failed: "errors.passkeyLoginFailed",
  passkey_failed: "errors.passkeyLoginFailed",
  capsule_contains_personal_items: "errors.capsuleContainsPersonalItems",
  capsule_not_shareable: "errors.capsuleNotShareable",
  shared_capsule_unavailable: "errors.sharedCapsuleUnavailable",
};

export function resolveAppErrorMessage(
  error: { message?: string } | null | undefined,
  t: (key: string, params?: Record<string, unknown>) => string,
) {
  if (error?.message === "passkey_cancelled") {
    return "";
  }

  return t(ERROR_MESSAGE_KEYS[error?.message || ""] || "errors.generic");
}
