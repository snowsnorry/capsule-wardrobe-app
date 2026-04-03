const FALLBACK_COLOR_SWATCH_KEY = "multicolor";

const COLOR_SWATCH_DEFINITIONS = Object.freeze({
  black: Object.freeze({
    client: Object.freeze({ bgcolor: "#1f2933" }),
    pdfFill: Object.freeze([0.12, 0.16, 0.2])
  }),
  white: Object.freeze({
    client: Object.freeze({ bgcolor: "#f8f5ef" }),
    pdfFill: Object.freeze([0.972, 0.961, 0.937])
  }),
  grey: Object.freeze({
    client: Object.freeze({ bgcolor: "#94a3b8" }),
    pdfFill: Object.freeze([0.58, 0.64, 0.72])
  }),
  beige: Object.freeze({
    client: Object.freeze({ bgcolor: "#d6c1a3" }),
    pdfFill: Object.freeze([0.839, 0.757, 0.639])
  }),
  brown: Object.freeze({
    client: Object.freeze({ bgcolor: "#8b5e3c" }),
    pdfFill: Object.freeze([0.545, 0.369, 0.235])
  }),
  blue: Object.freeze({
    client: Object.freeze({ bgcolor: "#4f83cc" }),
    pdfFill: Object.freeze([0.31, 0.514, 0.8])
  }),
  light_blue: Object.freeze({
    client: Object.freeze({ bgcolor: "#9ecae8" }),
    pdfFill: Object.freeze([0.62, 0.792, 0.91])
  }),
  navy: Object.freeze({
    client: Object.freeze({ bgcolor: "#243b6b" }),
    pdfFill: Object.freeze([0.141, 0.231, 0.42])
  }),
  green: Object.freeze({
    client: Object.freeze({ bgcolor: "#4d8b55" }),
    pdfFill: Object.freeze([0.302, 0.545, 0.333])
  }),
  khaki: Object.freeze({
    client: Object.freeze({ bgcolor: "#8a7f45" }),
    pdfFill: Object.freeze([0.541, 0.498, 0.271])
  }),
  red: Object.freeze({
    client: Object.freeze({ bgcolor: "#c84c4c" }),
    pdfFill: Object.freeze([0.784, 0.298, 0.298])
  }),
  burgundy: Object.freeze({
    client: Object.freeze({ bgcolor: "#7a1f3d" }),
    pdfFill: Object.freeze([0.478, 0.122, 0.239])
  }),
  pink: Object.freeze({
    client: Object.freeze({ bgcolor: "#d88aa6" }),
    pdfFill: Object.freeze([0.847, 0.541, 0.651])
  }),
  yellow: Object.freeze({
    client: Object.freeze({ bgcolor: "#d9b43b" }),
    pdfFill: Object.freeze([0.851, 0.706, 0.231])
  }),
  purple: Object.freeze({
    client: Object.freeze({ bgcolor: "#8a5fbf" }),
    pdfFill: Object.freeze([0.541, 0.373, 0.749])
  }),
  orange: Object.freeze({
    client: Object.freeze({ bgcolor: "#d97a2b" }),
    pdfFill: Object.freeze([0.851, 0.478, 0.169])
  }),
  denim: Object.freeze({
    client: Object.freeze({ bgcolor: "#5a78a8" }),
    pdfFill: Object.freeze([0.353, 0.471, 0.659])
  }),
  metallic: Object.freeze({
    client: Object.freeze({
      background: "linear-gradient(135deg, #f3f4f6 0%, #cbd5e1 35%, #94a3b8 55%, #e5e7eb 100%)"
    }),
    pdfFill: Object.freeze([0.741, 0.765, 0.804])
  }),
  multicolor: Object.freeze({
    client: Object.freeze({
      background: "linear-gradient(135deg, #ff6b6b 0%, #ffd166 25%, #06d6a0 50%, #4f83cc 75%, #b5179e 100%)"
    }),
    pdfFill: Object.freeze([0.31, 0.514, 0.8])
  })
});

const COLOR_SWATCH_KEYS = Object.freeze(Object.keys(COLOR_SWATCH_DEFINITIONS));

function normalizeColorSwatchKey(key) {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function getColorSwatchDefinition(key) {
  const normalizedKey = normalizeColorSwatchKey(key);
  return COLOR_SWATCH_DEFINITIONS[normalizedKey] || COLOR_SWATCH_DEFINITIONS[FALLBACK_COLOR_SWATCH_KEY];
}

function getColorSwatchStyle(key) {
  return getColorSwatchDefinition(key).client;
}

function getPdfColorSwatchFill(key) {
  return getColorSwatchDefinition(key).pdfFill;
}

export {
  COLOR_SWATCH_DEFINITIONS,
  COLOR_SWATCH_KEYS,
  FALLBACK_COLOR_SWATCH_KEY,
  normalizeColorSwatchKey,
  getColorSwatchStyle,
  getPdfColorSwatchFill
};
