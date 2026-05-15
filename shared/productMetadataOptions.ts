const PRODUCT_AUDIENCE_OPTIONS = ["woman", "man", "all"] as const;

const PRODUCT_CATEGORY_OPTIONS = [
  "top",
  "bottom",
  "midlayer",
  "outerwear",
  "dress",
  "shoes",
  "bag",
  "belt",
  "swimwear",
  "other",
] as const;

const PRODUCT_SEASON_OPTIONS = [
  "spring",
  "summer",
  "autumn",
  "winter",
] as const;

const PRODUCT_FORMALITY_LEVEL_OPTIONS = [
  "casual",
  "smart_casual",
  "formal",
] as const;

const PRODUCT_STYLE_OPTIONS = [
  "minimalistic",
  "street_style",
  "romantic",
  "preppy",
  "retro",
  "boho",
  "nautical",
  "safari",
  "equestrian",
  "military",
  "grunge",
  "sporty",
] as const;

const PRODUCT_OCCASION_OPTIONS = [
  "office",
  "brunch_in_the_city",
  "date_night",
  "everyday_errands",
] as const;

const PRODUCT_COLOR_BASE_OPTIONS = [
  "black",
  "white",
  "grey",
  "brown",
  "beige",
  "light_blue",
  "blue",
  "green",
  "red",
  "pink",
  "purple",
  "yellow",
  "orange",
  "metallic",
  "multicolor",
  "burgundy",
  "khaki",
  "navy",
  "denim",
] as const;

const PRODUCT_PATTERN_OPTIONS = [
  "solid",
  "stripe",
  "check",
  "floral",
  "leopard",
  "zebra",
  "snake",
  "crocodile",
  "paisley",
  "polka_dot",
  "houndstooth",
  "marble",
  "abstract",
  "lace",
  "corduroy",
  "camo",
  "logo",
  "argyle",
  "quilted",
  "tie_dye",
  "ribbed",
  "waffle",
  "cable",
  "jacquard",
  "color_block",
  "graphic",
  "herringbone",
] as const;

const PRODUCT_FINISH_OPTIONS = [
  "matte",
  "glossy",
  "satin",
  "metallic",
  "sheer",
  "textured",
  "distressed",
  "washed",
  "coated",
  "patent",
  "sequined",
  "beaded",
  "embroidered",
] as const;

const PRODUCT_MATERIAL_OPTIONS = [
  "suede",
  "leather",
  "wool",
  "cotton",
  "linen",
  "silk/viscose",
  "down insulation",
  "technical fabric",
  "rubber/eva",
  "other",
] as const;

const PRODUCT_SILHOUETTE_OPTIONS = [
  "straight",
  "a_line",
  "belted",
  "cocoon",
  "boxy",
  "asymmetric",
  "wide_leg",
  "flare",
  "balloon",
  "barrel",
  "tapered",
  "peplum",
  "wrap",
  "fit_and_flare",
  "cropped",
  "draped",
] as const;

const PRODUCT_FIT_OPTIONS = [
  "skinny",
  "slim",
  "regular",
  "relaxed",
  "loose",
  "oversized",
] as const;

const PRODUCT_CLOSURE_TYPE_OPTIONS = [
  "button",
  "zipper",
  "tie_belt",
  "snap",
  "hook_and_eye",
  "velcro",
  "buckle",
  "magnetic",
  "elastic",
  "lace_up",
  "drawstring",
  "toggle",
] as const;

export {
  PRODUCT_AUDIENCE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_CLOSURE_TYPE_OPTIONS,
  PRODUCT_COLOR_BASE_OPTIONS,
  PRODUCT_FINISH_OPTIONS,
  PRODUCT_FIT_OPTIONS,
  PRODUCT_FORMALITY_LEVEL_OPTIONS,
  PRODUCT_MATERIAL_OPTIONS,
  PRODUCT_OCCASION_OPTIONS,
  PRODUCT_PATTERN_OPTIONS,
  PRODUCT_SEASON_OPTIONS,
  PRODUCT_SILHOUETTE_OPTIONS,
  PRODUCT_STYLE_OPTIONS,
};
