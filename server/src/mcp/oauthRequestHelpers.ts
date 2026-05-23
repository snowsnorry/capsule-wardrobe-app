export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => readString(entry)).filter(Boolean)
    : [];
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function readOptionalStringArray(
  value: unknown,
  fallback: string[],
): string[] | null {
  if (value === undefined) {
    return fallback;
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const values = value.map((entry) => readString(entry));
  return values.length > 0 && values.every(Boolean) ? values : null;
}

export function hasOnlyAllowedValues(
  values: readonly string[],
  allowedValues: readonly string[],
): boolean {
  const allowed = new Set(allowedValues);
  return values.every((value) => allowed.has(value));
}
