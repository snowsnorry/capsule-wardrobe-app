function normalizeWardrobeSourceParam(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return value === "uploaded" || value === "from_catalog" ? value : "";
}

function normalizeWardrobeLikedOnlyParam(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return false;
  }

  return value === "true" || value === true ? true : "";
}

function normalizeWardrobeLimitParam(value: unknown, defaultLimit = 48) {
  if (value === undefined || value === null || value === "") {
    return defaultLimit;
  }

  const text = String(value).trim();
  if (!/^[1-9]\d*$/.test(text)) {
    return "";
  }

  const parsed = Number.parseInt(text, 10);
  if (!Number.isSafeInteger(parsed)) {
    return "";
  }

  return Math.min(parsed, 96);
}

function normalizeWardrobeCursorParam(value: unknown) {
  const cursor = String(value || "").trim();
  if (!cursor) {
    return null;
  }

  return /^[A-Za-z0-9_-]+$/.test(cursor) ? cursor : "";
}

export {
  normalizeWardrobeCursorParam,
  normalizeWardrobeLikedOnlyParam,
  normalizeWardrobeLimitParam,
  normalizeWardrobeSourceParam,
};
