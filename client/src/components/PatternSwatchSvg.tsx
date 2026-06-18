import { useId, type CSSProperties, type ReactNode } from "react";

type SvgPattern =
  | "leopard"
  | "zebra"
  | "snake"
  | "camo"
  | "crocodile"
  | "lace"
  | "floral"
  | "paisley"
  | "jacquard"
  | "graphic"
  | "abstract";

type SvgPatternSwatchProps = {
  pattern: SvgPattern;
  size: number;
  className?: string;
  style?: CSSProperties;
};

type SvgRenderProps = SvgPatternSwatchProps & {
  clipPathId: string;
};

type SvgFrameProps = SvgRenderProps & {
  background: string;
  children: ReactNode;
};

const swatchBorder = "rgba(15, 23, 42, 0.22)";

function renderSvgPatternSwatch(props: SvgPatternSwatchProps) {
  return <SvgPatternSwatch {...props} />;
}

function SvgPatternSwatch(props: SvgPatternSwatchProps) {
  const reactId = useId();
  const clipPathId = `pattern-swatch-${reactId.replace(/:/g, "")}`;
  const Renderer = SVG_PATTERN_RENDERERS[props.pattern];

  return <Renderer {...props} clipPathId={clipPathId} />;
}

function isSvgPattern(pattern: string): pattern is SvgPattern {
  return pattern in SVG_PATTERN_RENDERERS;
}

function SvgFrame({
  pattern,
  size,
  className,
  style,
  clipPathId,
  background,
  children,
}: SvgFrameProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      data-pattern-swatch={pattern}
      width={size}
      height={size}
      viewBox="0 0 18 18"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        width: size,
        height: size,
        flex: `0 0 ${size}px`,
        display: "inline-block",
        overflow: "hidden",
        verticalAlign: "middle",
        borderRadius: 999,
        ...style,
      }}
    >
      <defs>
        <clipPath id={clipPathId} clipPathUnits="userSpaceOnUse">
          <circle cx="9" cy="9" r="8.5" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipPathId})`}>
        <circle cx="9" cy="9" r="9" fill={background} />
        {children}
      </g>
      <circle
        cx="9"
        cy="9"
        r="8.5"
        fill="none"
        stroke={swatchBorder}
        strokeWidth="1"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function LeopardSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#f2d39b">
      <ellipse
        cx="4.2"
        cy="4.2"
        rx="2.4"
        ry="1.5"
        fill="#3b281c"
        transform="rotate(-25 4.2 4.2)"
      />
      <ellipse
        cx="4.2"
        cy="4.2"
        rx="1.1"
        ry="0.65"
        fill="#b7793b"
        transform="rotate(-25 4.2 4.2)"
      />
      <ellipse
        cx="11.2"
        cy="3.8"
        rx="2.3"
        ry="1.35"
        fill="#3b281c"
        transform="rotate(18 11.2 3.8)"
      />
      <ellipse
        cx="11.2"
        cy="3.8"
        rx="1"
        ry="0.55"
        fill="#b7793b"
        transform="rotate(18 11.2 3.8)"
      />
      <ellipse
        cx="7"
        cy="10.2"
        rx="2.7"
        ry="1.55"
        fill="#3b281c"
        transform="rotate(-12 7 10.2)"
      />
      <ellipse
        cx="7"
        cy="10.2"
        rx="1.15"
        ry="0.6"
        fill="#b7793b"
        transform="rotate(-12 7 10.2)"
      />
      <ellipse
        cx="13.6"
        cy="12"
        rx="2.1"
        ry="1.3"
        fill="#3b281c"
        transform="rotate(-35 13.6 12)"
      />
      <ellipse
        cx="13.6"
        cy="12"
        rx="0.9"
        ry="0.5"
        fill="#b7793b"
        transform="rotate(-35 13.6 12)"
      />
      <circle cx="2.2" cy="12.8" r="1.2" fill="#3b281c" />
      <circle cx="15.8" cy="7.2" r="1" fill="#3b281c" />
    </SvgFrame>
  );
}

function ZebraSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#f8fafc">
      <path
        d="M-2 2.2C2 .2 4.7 4.2 8.3 2.3C11.7 .6 14.7 .6 20 2.8"
        fill="none"
        stroke="#111827"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M-2 7C2 4.8 5.6 8.8 9.3 6.8C12.4 5.1 15.6 5.5 20 7.8"
        fill="none"
        stroke="#111827"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M-2 12.1C1.6 9.6 5 13.8 8.7 11.7C12.6 9.5 15.4 10.5 20 13.2"
        fill="none"
        stroke="#111827"
        strokeWidth="2.35"
        strokeLinecap="round"
      />
      <path
        d="M1 17C4.2 14.5 7.7 17.8 10.9 15.6C13 14.2 15.8 14.8 19.3 17.2"
        fill="none"
        stroke="#111827"
        strokeWidth="2.1"
        strokeLinecap="round"
      />
    </SvgFrame>
  );
}

function SnakeSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#9aa672">
      <path d="M4 1.4L6.3 3.7L4 6L1.7 3.7Z" fill="#334155" />
      <path d="M10.2 1.2L12.7 3.7L10.2 6.2L7.7 3.7Z" fill="#334155" />
      <path d="M16 1.6L18.2 3.8L16 6L13.8 3.8Z" fill="#334155" />
      <path d="M1 8.6L3.5 6.1L6 8.6L3.5 11.1Z" fill="#e5e0b7" />
      <path d="M7.4 8.5L9.9 6L12.4 8.5L9.9 11Z" fill="#e5e0b7" />
      <path d="M13.8 8.5L16.2 6.1L18.6 8.5L16.2 10.9Z" fill="#e5e0b7" />
      <path d="M4 13.6L6.3 11.3L8.6 13.6L6.3 15.9Z" fill="#334155" />
      <path d="M10.8 13.7L13.1 11.4L15.4 13.7L13.1 16Z" fill="#334155" />
      <path
        d="M-1 4.2H19M-1 9H19M-1 13.8H19"
        stroke="#475569"
        strokeWidth="0.7"
        opacity="0.45"
      />
    </SvgFrame>
  );
}

function CamoSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#c8b481">
      <path
        d="M-1 4.5C1.8 1.3 4.8 1 6.7 3.1C8.3 4.8 6.7 7 3.6 7.2C1.3 7.3-.4 6.3-1 4.5Z"
        fill="#415a3a"
      />
      <path
        d="M9.2 1.1C12-.5 15.8 1.2 16.2 3.8C16.6 6.6 12.3 6.8 10.4 5.3C8.9 4.2 7.3 2.2 9.2 1.1Z"
        fill="#6b5f3b"
      />
      <path
        d="M5.4 9.6C7.4 7.1 10.7 7 12.4 8.8C14.5 11 12.1 14.2 8.7 13.7C5.8 13.3 3.9 11.4 5.4 9.6Z"
        fill="#2f3d2c"
      />
      <path
        d="M-1 13.4C1.4 11.3 4.5 12 5.5 14.1C6.5 16.3 3.5 18.1.9 17.2C-.8 16.7-2.4 14.7-1 13.4Z"
        fill="#8a7a4a"
      />
      <path
        d="M13.3 12.7C15.8 10.6 19 12.1 19 14.7C19 17.2 15.1 18.4 13.3 16.2C12.4 15.1 12.2 13.6 13.3 12.7Z"
        fill="#4f6f42"
      />
    </SvgFrame>
  );
}

function CrocodileSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#6f8b62">
      <path
        d="M-1 3.4C1.2 1.7 3.3 1.7 5.1 3.4C6.9 5 9 5 10.8 3.4C12.8 1.7 15.1 1.7 19 3.6"
        fill="none"
        stroke="#2f4f37"
        strokeWidth="1.1"
      />
      <path
        d="M-1 8.9C1.2 7.2 3.3 7.2 5.1 8.9C6.9 10.5 9 10.5 10.8 8.9C12.8 7.2 15.1 7.2 19 9.1"
        fill="none"
        stroke="#2f4f37"
        strokeWidth="1.1"
      />
      <path
        d="M-1 14.2C1.2 12.5 3.3 12.5 5.1 14.2C6.9 15.8 9 15.8 10.8 14.2C12.8 12.5 15.1 12.5 19 14.4"
        fill="none"
        stroke="#2f4f37"
        strokeWidth="1.1"
      />
      <path
        d="M3 0.5V17.5M9 0.5V17.5M15 0.5V17.5"
        stroke="#36553b"
        strokeWidth="0.85"
        opacity="0.7"
      />
      <path
        d="M0.6 6.1H17.4M0.6 11.6H17.4"
        stroke="#9caf87"
        strokeWidth="0.75"
        opacity="0.75"
      />
    </SvgFrame>
  );
}

function LaceSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#fff7ed">
      <path
        d="M-2 9C1.2 4.8 3.9 13.2 7 9C10.1 4.8 12.9 13.2 16 9C17 7.7 18.4 7.7 20 9"
        fill="none"
        stroke="#64748b"
        strokeWidth="1.05"
        strokeLinecap="round"
      />
      <path
        d="M-2 4.5C1.2 .8 3.9 8.1 7 4.5C10.1 .8 12.9 8.1 16 4.5C17 3.3 18.4 3.3 20 4.5"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.85"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path
        d="M-2 13.5C1.2 9.9 3.9 17.2 7 13.5C10.1 9.9 12.9 17.2 16 13.5C17 12.3 18.4 12.3 20 13.5"
        fill="none"
        stroke="#94a3b8"
        strokeWidth="0.85"
        strokeLinecap="round"
        opacity="0.8"
      />
      <circle cx="4" cy="9" r="1.1" fill="#f8fafc" stroke="#64748b" />
      <circle cx="10" cy="9" r="1.1" fill="#f8fafc" stroke="#64748b" />
      <circle cx="16" cy="9" r="1.1" fill="#f8fafc" stroke="#64748b" />
    </SvgFrame>
  );
}

function FloralSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#fdf2f8">
      <g transform="translate(6 6)">
        <ellipse cx="0" cy="-2" rx="1.1" ry="2" fill="#be185d" />
        <ellipse cx="2" cy="0" rx="2" ry="1.1" fill="#be185d" />
        <ellipse cx="0" cy="2" rx="1.1" ry="2" fill="#be185d" />
        <ellipse cx="-2" cy="0" rx="2" ry="1.1" fill="#be185d" />
        <circle cx="0" cy="0" r="0.9" fill="#facc15" />
      </g>
      <g transform="translate(13 12) scale(0.8)">
        <ellipse cx="0" cy="-2" rx="1.1" ry="2" fill="#db2777" />
        <ellipse cx="2" cy="0" rx="2" ry="1.1" fill="#db2777" />
        <ellipse cx="0" cy="2" rx="1.1" ry="2" fill="#db2777" />
        <ellipse cx="-2" cy="0" rx="2" ry="1.1" fill="#db2777" />
        <circle cx="0" cy="0" r="0.9" fill="#fde047" />
      </g>
      <path
        d="M2 15C4.4 12.8 7.2 12.1 9.7 12.9"
        fill="none"
        stroke="#16a34a"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </SvgFrame>
  );
}

function PaisleySwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#fef3c7">
      <path
        d="M6.5 2.2C10.7 2.6 13.2 6.1 11.5 9.8C10.2 12.7 6.8 13.8 4.9 11.5C3.4 9.8 4.2 7.6 6.2 7.2C8.7 6.7 8.9 4 6.5 2.2Z"
        fill="#7c2d12"
      />
      <path
        d="M6.8 4C9.3 4.6 10.6 6.7 9.7 8.7C8.9 10.2 7 10.8 6 9.6C5.2 8.6 5.7 7.5 6.8 7.2C8.2 6.9 8.3 5.1 6.8 4Z"
        fill="#f97316"
      />
      <circle cx="7.5" cy="8" r="0.9" fill="#fef3c7" />
      <path
        d="M13.5 12.3C16 12.7 17.4 15 16.1 17.1C15.1 18.7 12.9 18.9 11.9 17.5C11.2 16.5 11.6 15.3 12.8 15C14.1 14.7 14.6 13.4 13.5 12.3Z"
        fill="#92400e"
        opacity="0.95"
      />
    </SvgFrame>
  );
}

function JacquardSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#ede9fe">
      <path d="M4.5 1.5L7.5 4.5L4.5 7.5L1.5 4.5Z" fill="#6d28d9" />
      <path d="M13.5 1.5L16.5 4.5L13.5 7.5L10.5 4.5Z" fill="#8b5cf6" />
      <path d="M9 6L12 9L9 12L6 9Z" fill="#4c1d95" />
      <path d="M4.5 10.5L7.5 13.5L4.5 16.5L1.5 13.5Z" fill="#8b5cf6" />
      <path d="M13.5 10.5L16.5 13.5L13.5 16.5L10.5 13.5Z" fill="#6d28d9" />
      <path
        d="M0 4.5H18M0 13.5H18M4.5 0V18M13.5 0V18"
        stroke="#c4b5fd"
        strokeWidth="0.75"
      />
    </SvgFrame>
  );
}

function GraphicSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#f8fafc">
      <rect x="2.2" y="2.4" width="5.2" height="5.2" rx="1" fill="#0f172a" />
      <circle cx="12.7" cy="5" r="2.7" fill="#ef4444" />
      <path d="M4 15.5L8.3 9.7L12.6 15.5Z" fill="#2563eb" />
      <path
        d="M11.2 10.6H16.3"
        stroke="#0f172a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M12.2 13.2H16"
        stroke="#0f172a"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </SvgFrame>
  );
}

function AbstractSwatch(props: SvgRenderProps) {
  return (
    <SvgFrame {...props} background="#eff6ff">
      <path
        d="M1.2 6.1C1.9 2.7 5.1 1.1 8 2.3C10.6 3.4 9.9 6.2 7.4 7.1C4.9 8 1 9.2 1.2 6.1Z"
        fill="#38bdf8"
      />
      <path
        d="M8.2 14.8C5.7 12.2 7.3 8.9 10.5 8.7C13.6 8.5 16.5 10.6 16 13.5C15.5 16.5 10.6 17.2 8.2 14.8Z"
        fill="#a855f7"
      />
      <path
        d="M-1 13.5C3.8 9.4 8.7 9.1 19 12.8"
        fill="none"
        stroke="#0f172a"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.7"
      />
      <circle cx="13.9" cy="4.1" r="1.7" fill="#f97316" />
      <circle cx="4.3" cy="13.5" r="1" fill="#0f172a" />
    </SvgFrame>
  );
}

const SVG_PATTERN_RENDERERS: Record<
  SvgPattern,
  (props: SvgRenderProps) => ReactNode
> = {
  leopard: LeopardSwatch,
  zebra: ZebraSwatch,
  snake: SnakeSwatch,
  camo: CamoSwatch,
  crocodile: CrocodileSwatch,
  lace: LaceSwatch,
  floral: FloralSwatch,
  paisley: PaisleySwatch,
  jacquard: JacquardSwatch,
  graphic: GraphicSwatch,
  abstract: AbstractSwatch,
};

export { isSvgPattern, renderSvgPatternSwatch };
export type { SvgPattern };
