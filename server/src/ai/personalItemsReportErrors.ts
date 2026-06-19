type PersonalItemsReportErrorCode =
  | "invalid_payload"
  | "not_found"
  | "service_unavailable";

type PersonalItemsReportError = Error & {
  code?: PersonalItemsReportErrorCode;
};

function buildPersonalItemsReportError(
  code: PersonalItemsReportErrorCode,
  message: string = code,
): PersonalItemsReportError {
  const error = new Error(message) as PersonalItemsReportError;
  error.code = code;
  return error;
}

function isPersonalItemsReportDomainError(error: unknown) {
  return ["invalid_payload", "not_found", "service_unavailable"].includes(
    String((error as PersonalItemsReportError).code),
  );
}

export { buildPersonalItemsReportError, isPersonalItemsReportDomainError };
