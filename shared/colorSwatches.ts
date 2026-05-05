const FALLBACK_COLOR_SWATCH_KEY = "multicolor";

const COLOR_SWATCH_DEFINITIONS = Object.freeze({
  black: Object.freeze({
    client: Object.freeze({ bgcolor: "#0f172a" }), // Глубокий темный сланец вместо скучного черного
    pdfFill: Object.freeze([0.059, 0.090, 0.165])
  }),
  white: Object.freeze({
    client: Object.freeze({ bgcolor: "#ffffff" }),
    pdfFill: Object.freeze([1, 1, 1])
  }),
  grey: Object.freeze({
    client: Object.freeze({ bgcolor: "#9ca3af" }), // Чистый холодный серый
    pdfFill: Object.freeze([0.612, 0.639, 0.686])
  }),
  beige: Object.freeze({
    client: Object.freeze({ bgcolor: "#e6ccb2" }), // Теплый песочный
    pdfFill: Object.freeze([0.902, 0.800, 0.698])
  }),
  brown: Object.freeze({
    client: Object.freeze({ bgcolor: "#9c6644" }), // Насыщенный терракотово-коричневый
    pdfFill: Object.freeze([0.612, 0.400, 0.267])
  }),
  blue: Object.freeze({
    client: Object.freeze({ bgcolor: "#3b82f6" }), // Яркий синий (SaaS blue)
    pdfFill: Object.freeze([0.231, 0.510, 0.965])
  }),
  light_blue: Object.freeze({
    client: Object.freeze({ bgcolor: "#38bdf8" }), // Сочный голубой
    pdfFill: Object.freeze([0.220, 0.741, 0.973])
  }),
  navy: Object.freeze({
    client: Object.freeze({ bgcolor: "#1e3a8a" }), // Глубокий морской синий
    pdfFill: Object.freeze([0.118, 0.227, 0.541])
  }),
  green: Object.freeze({
    client: Object.freeze({ bgcolor: "#10b981" }), // Изумрудный / Мятный
    pdfFill: Object.freeze([0.063, 0.725, 0.506])
  }),
  khaki: Object.freeze({
    client: Object.freeze({ bgcolor: "#a3b18a" }), // Свежий оливковый
    pdfFill: Object.freeze([0.639, 0.694, 0.541])
  }),
  red: Object.freeze({
    client: Object.freeze({ bgcolor: "#ef4444" }), // Яркий кораллово-красный
    pdfFill: Object.freeze([0.937, 0.267, 0.267])
  }),
  burgundy: Object.freeze({
    client: Object.freeze({ bgcolor: "#9f1239" }), // Насыщенный бордово-розовый
    pdfFill: Object.freeze([0.624, 0.071, 0.224])
  }),
  pink: Object.freeze({
    client: Object.freeze({ bgcolor: "#ec4899" }), // Яркая фуксия
    pdfFill: Object.freeze([0.925, 0.282, 0.600])
  }),
  yellow: Object.freeze({
    client: Object.freeze({ bgcolor: "#fbbf24" }), // Теплый лимонный/янтарный
    pdfFill: Object.freeze([0.984, 0.749, 0.141])
  }),
  purple: Object.freeze({
    client: Object.freeze({ bgcolor: "#8b5cf6" }), // Сочный фиолетовый
    pdfFill: Object.freeze([0.545, 0.361, 0.965])
  }),
  orange: Object.freeze({
    client: Object.freeze({ bgcolor: "#f97316" }), // Апельсиновый
    pdfFill: Object.freeze([0.976, 0.451, 0.086])
  }),
  denim: Object.freeze({
    client: Object.freeze({ bgcolor: "#5a78a8" }),
    pdfFill: Object.freeze([0.353, 0.471, 0.659])
  }),
  metallic: Object.freeze({
    client: Object.freeze({
      background: "linear-gradient(135deg, #f8fafc 0%, #cbd5e1 35%, #94a3b8 55%, #f1f5f9 100%)"
    }),
    pdfFill: Object.freeze([0.612, 0.639, 0.686]) // Fallback на серый
  }),
  multicolor: Object.freeze({
    client: Object.freeze({
      background: "linear-gradient(135deg, #ff6b6b 0%, #ffd166 25%, #06d6a0 50%, #4f83cc 75%, #b5179e 100%)"
    }),
    pdfFill: Object.freeze([0.31, 0.514, 0.8])
  }),
  multiple_accent_colors: Object.freeze({
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
