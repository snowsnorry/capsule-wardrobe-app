const EXACT_COLOR_RANGE_VALUES = [
  "closest",
  "close",
  "balanced",
  "broad",
  "broadest",
] as const;

type ExactColorRange = (typeof EXACT_COLOR_RANGE_VALUES)[number];

const DEFAULT_EXACT_COLOR_RANGE: ExactColorRange = "balanced";

const EXACT_COLOR_RANGE_LABEL_KEYS = {
  closest: "search.filters.exactColorRangeClosest",
  close: "search.filters.exactColorRangeClose",
  balanced: "search.filters.exactColorRangeBalanced",
  broad: "search.filters.exactColorRangeBroad",
  broadest: "search.filters.exactColorRangeBroadest",
} as const satisfies Record<ExactColorRange, string>;

function normalizeExactColorRange(value: unknown): ExactColorRange {
  return typeof value === "string" &&
    EXACT_COLOR_RANGE_VALUES.includes(value as ExactColorRange)
    ? (value as ExactColorRange)
    : DEFAULT_EXACT_COLOR_RANGE;
}

function getExactColorRangeLabelKey(range: ExactColorRange): string {
  return EXACT_COLOR_RANGE_LABEL_KEYS[range];
}

export {
  DEFAULT_EXACT_COLOR_RANGE,
  EXACT_COLOR_RANGE_VALUES,
  getExactColorRangeLabelKey,
  normalizeExactColorRange,
};
export type { ExactColorRange };
