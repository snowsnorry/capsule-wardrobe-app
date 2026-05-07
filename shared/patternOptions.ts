const CANONICAL_PATTERN_OPTIONS = Object.freeze([
  "solid",
  "abstract",
  "argyle",
  "cable",
  "camo",
  "check",
  "color_block",
  "corduroy",
  "crocodile",
  "floral",
  "graphic",
  "herringbone",
  "houndstooth",
  "jacquard",
  "lace",
  "leopard",
  "logo",
  "marble",
  "paisley",
  "polka_dot",
  "quilted",
  "ribbed",
  "snake",
  "stripe",
  "tie_dye",
  "waffle",
  "zebra",
] as const);

function normalizePatternOption(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function buildCanonicalPatternOptions(
  patternOptions: readonly unknown[] = [],
  currentPattern: unknown = null,
): string[] {
  const seen = new Set<string>();
  const extras: string[] = [];

  for (const value of [...patternOptions, currentPattern]) {
    const normalized = normalizePatternOption(value);
    if (
      !normalized ||
      seen.has(normalized) ||
      (CANONICAL_PATTERN_OPTIONS as readonly string[]).includes(normalized)
    ) {
      continue;
    }
    seen.add(normalized);
    extras.push(normalized);
  }

  return [...CANONICAL_PATTERN_OPTIONS, ...extras];
}

export {
  CANONICAL_PATTERN_OPTIONS,
  buildCanonicalPatternOptions,
  normalizePatternOption,
};
