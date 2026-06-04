import { describe, expect, test } from "vitest";
import { createAppTheme } from "./theme";
import { createThemeCssVariables } from "./themeCssVariables";

type Rgb = [number, number, number];
type Rgba = [number, number, number, number];

const AA_NORMAL_TEXT_CONTRAST = 4.5;
const NON_TEXT_CONTRAST = 3;

function parseHexColor(value: string): Rgb {
  const hex = value.replace("#", "");
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ];
}

function parseRgbaColor(value: string): Rgba {
  const match = /^rgba\((\d+), (\d+), (\d+), ([\d.]+)\)$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported rgba color: ${value}`);
  }

  return [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
  ];
}

function parseOklchColor(value: string): Rgb {
  const match = /^oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)$/.exec(value);
  if (!match) {
    throw new Error(`Unsupported oklch color: ${value}`);
  }

  const lightness = Number(match[1]) / 100;
  const chroma = Number(match[2]);
  const hueRadians = (Number(match[3]) * Math.PI) / 180;
  const a = chroma * Math.cos(hueRadians);
  const b = chroma * Math.sin(hueRadians);
  const l = lightness + 0.3963377774 * a + 0.2158037573 * b;
  const m = lightness - 0.1055613458 * a - 0.0638541728 * b;
  const s = lightness - 0.0894841775 * a - 1.291485548 * b;
  const lms = [l ** 3, m ** 3, s ** 3] as const;

  return [
    toSrgbByte(
      4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    ),
    toSrgbByte(
      -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    ),
    toSrgbByte(
      -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
    ),
  ];
}

function toSrgbByte(linear: number): number {
  const clamped = Math.min(1, Math.max(0, linear));
  const channel =
    clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * clamped ** (1 / 2.4) - 0.055;

  return Math.round(channel * 255);
}

function parseColor(value: string): Rgb {
  if (value.startsWith("#")) return parseHexColor(value);
  if (value.startsWith("oklch(")) return parseOklchColor(value);

  throw new Error(`Unsupported color: ${value}`);
}

function resolveCssVariable(
  value: string,
  variables: Record<string, number | string>,
) {
  const match = /^var\((--cw-[^)]+)\)$/.exec(value);
  if (!match) return value;

  const resolved = variables[match[1]];
  if (!resolved) {
    throw new Error(`Missing CSS variable: ${match[1]}`);
  }

  return String(resolved);
}

function cssVariable(
  name: string,
  variables: Record<string, number | string>,
): string {
  const value = variables[name];
  if (!value) {
    throw new Error(`Missing CSS variable: ${name}`);
  }

  return String(value);
}

function composite(foreground: Rgba, background: Rgb): Rgb {
  const [red, green, blue, alpha] = foreground;
  return [
    Math.round(red * alpha + background[0] * (1 - alpha)),
    Math.round(green * alpha + background[1] * (1 - alpha)),
    Math.round(blue * alpha + background[2] * (1 - alpha)),
  ];
}

function relativeLuminance([red, green, blue]: Rgb): number {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const fgLuminance = relativeLuminance(foreground);
  const bgLuminance = relativeLuminance(background);

  return (
    (Math.max(fgLuminance, bgLuminance) + 0.05) /
    (Math.min(fgLuminance, bgLuminance) + 0.05)
  );
}

describe("theme component menu alignment", () => {
  test("aligns text-only menu items with icon menu item text", () => {
    const theme = createAppTheme("light");
    const menuItemRoot = theme.components?.MuiMenuItem?.styleOverrides
      ?.root as Record<string, Record<string, number>>;

    expect(
      menuItemRoot[
        '[role="menu"]:has(.MuiListItemIcon-root) &:not(:has(.MuiListItemIcon-root))'
      ]?.paddingLeft,
    ).toBe(52);
  });
});

describe("theme component contrast", () => {
  test("keeps light selected chips above contrast thresholds", () => {
    const theme = createAppTheme("light");
    const variables = createThemeCssVariables("light");
    const chipRoot = theme.components?.MuiChip?.styleOverrides?.root as {
      variants?: Array<{
        props: Record<string, string>;
        style: Record<string, unknown>;
      }>;
    };
    const filledPrimary = chipRoot.variants?.find(
      (variant) =>
        variant.props.variant === "filled" && variant.props.color === "primary",
    )?.style as Record<string, unknown>;
    const hover = filledPrimary["&:hover"] as Record<string, string>;
    const deleteIcon = filledPrimary["& .MuiChip-deleteIcon"] as Record<
      string,
      string
    >;
    const textColor = parseColor(String(filledPrimary.color));
    const deleteIconColor = parseRgbaColor(deleteIcon.color);
    const backgroundValues = [
      String(filledPrimary.backgroundColor),
      hover.backgroundColor,
    ];

    for (const backgroundValue of backgroundValues) {
      const background = parseColor(
        resolveCssVariable(backgroundValue, variables),
      );
      const compositedDeleteIcon = composite(deleteIconColor, background);

      expect(contrastRatio(textColor, background)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT_CONTRAST,
      );
      expect(
        contrastRatio(compositedDeleteIcon, background),
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  test("keeps product image placeholder text readable", () => {
    for (const mode of ["light", "dark"] as const) {
      const variables = createThemeCssVariables(mode);
      const imageWash = parseColor(
        cssVariable("--cw-color-product-image-wash", variables),
      );
      const placeholderText = composite(
        parseRgbaColor(
          cssVariable("--cw-color-product-placeholder-text", variables),
        ),
        imageWash,
      );
      const placeholderMarker = composite(
        parseRgbaColor(
          cssVariable("--cw-color-product-placeholder-marker", variables),
        ),
        imageWash,
      );

      expect(contrastRatio(placeholderText, imageWash)).toBeGreaterThanOrEqual(
        AA_NORMAL_TEXT_CONTRAST,
      );
      expect(
        contrastRatio(placeholderMarker, imageWash),
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  test("keeps image action controls readable on product image surfaces", () => {
    for (const mode of ["light", "dark"] as const) {
      const variables = createThemeCssVariables(mode);
      const imageWash = parseColor(
        cssVariable("--cw-color-product-image-wash", variables),
      );
      const desktopActionSurface = composite(
        parseRgbaColor(cssVariable("--cw-color-on-image-action-bg", variables)),
        imageWash,
      );
      const desktopActionInk = parseColor(
        cssVariable("--cw-color-on-image-action-ink", variables),
      );
      const mobileActionSurface = composite(
        parseRgbaColor(
          cssVariable("--cw-color-mobile-image-action-bg", variables),
        ),
        imageWash,
      );
      const mobileActionInk = parseColor(
        cssVariable("--cw-color-mobile-image-action-ink", variables),
      );
      const mobileActionBorder = parseRgbaColor(
        cssVariable("--cw-color-mobile-image-action-border", variables),
      );
      const mobileActionSurfaceOnDarkImage = composite(
        parseRgbaColor(
          cssVariable("--cw-color-mobile-image-action-bg", variables),
        ),
        [0, 0, 0],
      );

      expect(
        contrastRatio(desktopActionInk, desktopActionSurface),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_CONTRAST);
      expect(
        contrastRatio(mobileActionInk, mobileActionSurface),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_CONTRAST);
      expect(mobileActionBorder[3]).toBeGreaterThan(0);
      expect(
        contrastRatio(mobileActionSurfaceOnDarkImage, [0, 0, 0]),
      ).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
    }
  });

  test("keeps chart tooltip text readable", () => {
    for (const mode of ["light", "dark"] as const) {
      const variables = createThemeCssVariables(mode);
      const tooltipBackground = parseColor(
        cssVariable("--cw-chart-tooltip-bg", variables),
      );
      const tooltipInk = parseColor(
        cssVariable("--cw-chart-tooltip-ink", variables),
      );

      expect(
        contrastRatio(tooltipInk, tooltipBackground),
      ).toBeGreaterThanOrEqual(AA_NORMAL_TEXT_CONTRAST);
    }
  });
});
