type StyleValue = string;
type StyleOption = {
  value: StyleValue;
  disabled: boolean;
};

const CORE_STYLE_ORDER = ["casual", "smart_casual", "formal", "minimalistic", "street_style"] as const;
const AESTHETICS_STYLE_ORDER = [
  "romantic",
  "preppy",
  "retro",
  "boho",
  "nautical",
  "safari",
  "equestrian",
  "military",
  "grunge",
  "sporty"
] as const;

const CORE_STYLE_SET = new Set<string>(CORE_STYLE_ORDER);
const AESTHETICS_STYLE_SET = new Set<string>(AESTHETICS_STYLE_ORDER);

function makeStyleOption(value: StyleValue, disabled: boolean): StyleOption {
  return { value, disabled };
}

function normalizeStyleValue(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function dedupeStyleValues(items: readonly unknown[] = []): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const normalized = normalizeStyleValue(item);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function partitionStyleValues(items: readonly unknown[] = []): {
  core: StyleOption[];
  aesthetics: StyleOption[];
} {
  const normalized = dedupeStyleValues(items);
  const available = new Set(normalized);
  const core = CORE_STYLE_ORDER.map((item) => makeStyleOption(item, !available.has(item)));
  const aesthetics = AESTHETICS_STYLE_ORDER.map((item) => makeStyleOption(item, !available.has(item)));
  const extras = normalized.filter((item) => !CORE_STYLE_SET.has(item) && !AESTHETICS_STYLE_SET.has(item));

  return {
    core,
    aesthetics: [...aesthetics, ...extras.map((item) => makeStyleOption(item, false))]
  };
}

function getEnabledStyleValues(items: readonly Partial<StyleOption>[] = []): string[] {
  return items.flatMap((item) => {
    if (!item || typeof item.value !== "string" || item.disabled === true) {
      return [];
    }

    return [item.value];
  });
}

function buildFallbackStyleOptions({ disabled = false }: { disabled?: boolean } = {}): {
  core: StyleOption[];
  aesthetics: StyleOption[];
} {
  return {
    core: CORE_STYLE_ORDER.map((item) => makeStyleOption(item, disabled)),
    aesthetics: AESTHETICS_STYLE_ORDER.map((item) => makeStyleOption(item, disabled))
  };
}

function inferStyleSelections(stylePreferences: readonly unknown[] = []): {
  styleCore: string | null;
  styleAesthetic: string | null;
} {
  const normalized = dedupeStyleValues(stylePreferences);
  const styleCore = normalized.find((item) => CORE_STYLE_SET.has(item)) || null;
  const styleAesthetic =
    normalized.find((item) => AESTHETICS_STYLE_SET.has(item) || (!CORE_STYLE_SET.has(item) && item)) || null;

  return { styleCore, styleAesthetic };
}

function buildStylePreferenceArray(styleCore: unknown, styleAesthetic: unknown): string[] {
  return dedupeStyleValues([styleCore, styleAesthetic]);
}

export {
  CORE_STYLE_ORDER,
  AESTHETICS_STYLE_ORDER,
  normalizeStyleValue,
  partitionStyleValues,
  getEnabledStyleValues,
  buildFallbackStyleOptions,
  inferStyleSelections,
  buildStylePreferenceArray
};
