type CapsuleReportErrorCode =
  | "invalid_payload"
  | "not_found"
  | "service_unavailable";

type CapsuleReportError = Error & {
  code?: CapsuleReportErrorCode;
};

function buildCapsuleReportError(
  code: CapsuleReportErrorCode,
  message: string = code,
): CapsuleReportError {
  const error = new Error(message) as CapsuleReportError;
  error.code = code;
  return error;
}

function isCapsuleReportDomainError(error: unknown) {
  return ["service_unavailable", "invalid_payload", "not_found"].includes(
    String((error as CapsuleReportError).code),
  );
}

export { buildCapsuleReportError, isCapsuleReportDomainError };
