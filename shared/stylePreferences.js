const CORE_STYLE_ORDER = ["casual", "smart_casual", "formal", "minimalistic", "street_style"];
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
];

const CORE_STYLE_SET = new Set(CORE_STYLE_ORDER);
const AESTHETICS_STYLE_SET = new Set(AESTHETICS_STYLE_ORDER);

function makeStyleOption(value, disabled) {
  return { value, disabled };
}

function normalizeStyleValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toLowerCase();
}

function dedupeStyleValues(items = []) {
  const result = [];
  const seen = new Set();

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

function partitionStyleValues(items = []) {
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

function getEnabledStyleValues(items = []) {
  return items
    .filter((item) => item && typeof item.value === "string" && item.disabled !== true)
    .map((item) => item.value);
}

function buildFallbackStyleOptions({ disabled = false } = {}) {
  return {
    core: CORE_STYLE_ORDER.map((item) => makeStyleOption(item, disabled)),
    aesthetics: AESTHETICS_STYLE_ORDER.map((item) => makeStyleOption(item, disabled))
  };
}

function inferStyleSelections(stylePreferences = []) {
  const normalized = dedupeStyleValues(stylePreferences);
  const styleCore = normalized.find((item) => CORE_STYLE_SET.has(item)) || null;
  const styleAesthetic =
    normalized.find((item) => AESTHETICS_STYLE_SET.has(item) || (!CORE_STYLE_SET.has(item) && item)) || null;

  return { styleCore, styleAesthetic };
}

function buildStylePreferenceArray(styleCore, styleAesthetic) {
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
