import { type CSSProperties } from "react";
import {
  isSvgPattern,
  renderSvgPatternSwatch,
  type SvgPattern,
} from "./PatternSwatchSvg";

type CssPattern =
  | "solid"
  | "stripe"
  | "check"
  | "polka_dot"
  | "ribbed"
  | "waffle"
  | "color_block";

type PatternSwatchPattern = CssPattern | SvgPattern;

type PatternSwatchProps = {
  pattern: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_SIZE = 18;

const swatchColors = {
  border: "rgba(15, 23, 42, 0.22)",
  ink: "#1f2937",
  inkSoft: "rgba(31, 41, 55, 0.58)",
  line: "rgba(31, 41, 55, 0.32)",
  paper: "#f8fafc",
};

const CSS_PATTERN_STYLES: Record<CssPattern, CSSProperties> = {
  solid: {
    backgroundColor: "#94a3b8",
  },
  stripe: {
    backgroundColor: swatchColors.paper,
    backgroundImage: `repeating-linear-gradient(
      45deg,
      ${swatchColors.ink} 0 2px,
      ${swatchColors.paper} 2px 5px
    )`,
  },
  check: {
    backgroundColor: swatchColors.paper,
    backgroundImage: `repeating-conic-gradient(
      ${swatchColors.ink} 0 25%,
      ${swatchColors.paper} 0 50%
    )`,
    backgroundSize: "7px 7px",
  },
  polka_dot: {
    backgroundColor: swatchColors.paper,
    backgroundImage: `radial-gradient(
      circle,
      ${swatchColors.ink} 0 1.7px,
      transparent 1.8px
    )`,
    backgroundPosition: "1px 1px",
    backgroundSize: "6px 6px",
  },
  ribbed: {
    backgroundColor: "#e2e8f0",
    backgroundImage: `repeating-linear-gradient(
      90deg,
      ${swatchColors.inkSoft} 0 1px,
      transparent 1px 3px
    )`,
  },
  waffle: {
    backgroundColor: "#e2e8f0",
    backgroundImage: `
      repeating-linear-gradient(
        0deg,
        ${swatchColors.line} 0 1px,
        transparent 1px 5px
      ),
      repeating-linear-gradient(
        90deg,
        ${swatchColors.line} 0 1px,
        transparent 1px 5px
      )
    `,
  },
  color_block: {
    backgroundImage:
      "linear-gradient(135deg, #0f172a 0 34%, #94a3b8 34% 67%, #f8fafc 67% 100%)",
  },
};

function PatternSwatch({
  pattern,
  size = DEFAULT_SIZE,
  className,
  style,
}: PatternSwatchProps) {
  if (isCssPattern(pattern)) {
    return (
      <CssPatternSwatch
        pattern={pattern}
        size={size}
        className={className}
        style={style}
      />
    );
  }

  if (isSvgPattern(pattern)) {
    return renderSvgPatternSwatch({ pattern, size, className, style });
  }

  return (
    <span
      aria-hidden="true"
      className={className}
      data-pattern-swatch-empty={pattern}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-block",
        visibility: "hidden",
        ...style,
      }}
    />
  );
}

function isPatternSwatchPattern(
  pattern: string,
): pattern is PatternSwatchPattern {
  return isCssPattern(pattern) || isSvgPattern(pattern);
}

function isCssPattern(pattern: string): pattern is CssPattern {
  return pattern in CSS_PATTERN_STYLES;
}

function CssPatternSwatch({
  pattern,
  size,
  className,
  style,
}: PatternSwatchProps & { pattern: CssPattern; size: number }) {
  return (
    <span
      aria-hidden="true"
      className={className}
      data-pattern-swatch={pattern}
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-block",
        boxSizing: "border-box",
        overflow: "hidden",
        verticalAlign: "middle",
        borderRadius: 999,
        border: `1px solid ${swatchColors.border}`,
        ...CSS_PATTERN_STYLES[pattern],
        ...style,
      }}
    />
  );
}

export { PatternSwatch, isPatternSwatchPattern };
