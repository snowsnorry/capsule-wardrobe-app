const HEX_COLOR_PATTERN = /^#([0-9a-f]{6})$/i;

function srgbChannelToLinear(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

function xyzPivot(value: number): number {
  const delta = 6 / 29;
  return value > delta ** 3
    ? Math.cbrt(value)
    : value / (3 * delta ** 2) + 4 / 29;
}

export function hexToLab(hex: string): [number, number, number] {
  const match = HEX_COLOR_PATTERN.exec(hex);
  if (!match) {
    throw new Error("invalid_hex_color");
  }

  const red = srgbChannelToLinear(Number.parseInt(match[1].slice(0, 2), 16));
  const green = srgbChannelToLinear(Number.parseInt(match[1].slice(2, 4), 16));
  const blue = srgbChannelToLinear(Number.parseInt(match[1].slice(4, 6), 16));

  const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047;
  const y = 0.2126729 * red + 0.7151522 * green + 0.072175 * blue;
  const z = (0.0193339 * red + 0.119192 * green + 0.9503041 * blue) / 1.08883;
  const fx = xyzPivot(x);
  const fy = xyzPivot(y);
  const fz = xyzPivot(z);

  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function hexToLabVector(hex: string): string {
  return `[${hexToLab(hex).join(",")}]`;
}
