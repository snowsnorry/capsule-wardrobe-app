import { type CSSProperties } from "react";

const PATTERN_SPRITE_URL = "/patterns/pattern-sprite.webp";
const SPRITE_COLUMNS = 7;
const SPRITE_ROWS = 4;
const DEFAULT_SIZE = 20;
const TILE_RENDER_SCALE = 1;

const PATTERN_SPRITE_COORDS = {
  abstract: [0, 0],
  argyle: [1, 0],
  cable: [2, 0],
  camo: [3, 0],
  check: [4, 0],
  color_block: [5, 0],
  corduroy: [6, 0],

  crocodile: [0, 1],
  floral: [1, 1],
  graphic: [2, 1],
  herringbone: [3, 1],
  houndstooth: [4, 1],
  jacquard: [5, 1],
  lace: [6, 1],

  leopard: [0, 2],
  logo: [1, 2],
  marble: [2, 2],
  paisley: [3, 2],
  polka_dot: [4, 2],
  quilted: [5, 2],
  ribbed: [6, 2],

  snake: [0, 3],
  solid: [1, 3],
  stripe: [2, 3],
  tie_dye: [3, 3],
  waffle: [4, 3],
  zebra: [5, 3],
} as const;

type PatternSwatchPattern = keyof typeof PATTERN_SPRITE_COORDS;

type PatternSwatchProps = {
  pattern: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
};

function PatternSwatch({
  pattern,
  size = DEFAULT_SIZE,
  className,
  style,
}: PatternSwatchProps) {
  if (!isPatternSwatchPattern(pattern)) {
    return null;
  }

  const [col, row] = PATTERN_SPRITE_COORDS[pattern];
  const scaledTileSize = size * TILE_RENDER_SCALE;
  const backgroundSize = `${SPRITE_COLUMNS * scaledTileSize}px ${
    SPRITE_ROWS * scaledTileSize
  }px`;
  const backgroundPosition = `${-col * scaledTileSize}px ${
    -row * scaledTileSize
  }px`;

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
        overflow: "hidden",
        verticalAlign: "middle",
        borderRadius: "50%",
        backgroundImage: `url(${PATTERN_SPRITE_URL})`,
        backgroundRepeat: "no-repeat",
        backgroundSize,
        backgroundPosition,
        boxShadow: "inset 0 0 0 1px rgba(15, 23, 42, 0.22)",
        ...style,
      }}
    />
  );
}

function isPatternSwatchPattern(
  pattern: string,
): pattern is PatternSwatchPattern {
  return Object.prototype.hasOwnProperty.call(PATTERN_SPRITE_COORDS, pattern);
}

export { PatternSwatch };
