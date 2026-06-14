type OutfitReportErrorCode =
  | "invalid_payload"
  | "not_found"
  | "service_unavailable";
type OutfitReportError = Error & {
  code?: OutfitReportErrorCode;
};

function buildOutfitReportError(
  code: OutfitReportErrorCode,
  message: string = code,
): OutfitReportError {
  const error = new Error(message) as OutfitReportError;
  error.code = code;
  return error;
}

function isOutfitReportDomainError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  return ["service_unavailable", "invalid_payload", "not_found"].includes(
    String((error as OutfitReportError).code),
  );
}

export {
  buildOutfitReportError,
  isOutfitReportDomainError,
  type OutfitReportError,
  type OutfitReportErrorCode,
};
