import { Box, useTheme } from "@mui/material";
import type { CSSProperties, ReactElement } from "react";
import { useState } from "react";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  getChartFocusFilter,
  getChartTheme,
  getTooltipStyle,
  getTooltipTextStyle,
} from "./chartUtils";
import ChartContainer from "./ChartContainer";

type BarChartDatum = {
  rawValue: string;
  color: string;
  activeColor?: string;
  isActive?: boolean;
  groupLabel: string;
  gradientId?: string;
  gradientStops?: string[];
  [key: string]: string | number | boolean | string[] | undefined;
};

type AxisTickPayload = {
  value?: string | number;
};

type AxisTickProps = {
  x?: number | string;
  y?: number | string;
  payload?: AxisTickPayload;
};

type TooltipPayloadItem = {
  payload?: Record<string, unknown>;
};

type BarChartProps = {
  data: BarChartDatum[];
  index: string;
  category: string;
  valueFormatter: (value: number) => string;
  onValueChange?: (row: BarChartDatum) => void;
  activeValues?: string[];
};

function isBarChartDatum(value: unknown): value is BarChartDatum {
  return typeof value === "object" && value !== null && "rawValue" in value;
}

function BarChart({
  data,
  index,
  category,
  valueFormatter,
  onValueChange,
  activeValues = [],
}: BarChartProps) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const hasSelection = activeValues.length > 0;
  const activeLabels = new Set(
    data.filter((row) => row.isActive).map((row) => row[index]),
  );
  const colors = {
    ...getChartTheme(isDarkMode),
    tooltipStyle: getTooltipStyle(isDarkMode),
    tooltipTextStyle: getTooltipTextStyle(isDarkMode),
  };

  return (
    <ChartContainer
      renderChart={({ width, height }) => (
        <BarChartPlot
          activeLabels={activeLabels}
          category={category}
          colors={colors}
          data={data}
          focusedValue={focusedValue}
          hasSelection={hasSelection}
          height={height}
          index={index}
          onValueChange={onValueChange}
          valueFormatter={valueFormatter}
          width={width}
        />
      )}
      sx={{
        height: 360,
        "& .recharts-surface:focus": {
          outline: "none",
        },
        "& .recharts-surface:focus-visible .recharts-bar-rectangle": {
          filter: getChartFocusFilter({
            blur: 4,
            glow: colors.focusSoftGlow,
            brightness: 1.04,
          }),
        },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          width: 1,
          height: 1,
          p: 0,
          m: -1,
          overflow: "hidden",
          clip: "rect(0 0 0 0)",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        <BarChartA11yButtons
          data={data}
          index={index}
          onFocusValue={setFocusedValue}
          onValueChange={onValueChange}
        />
      </Box>
    </ChartContainer>
  );
}

function BarChartPlot({
  activeLabels,
  category,
  colors,
  data,
  focusedValue,
  hasSelection,
  height,
  index,
  onValueChange,
  valueFormatter,
  width,
}) {
  return (
    <RechartsBarChart
      width={width}
      height={height}
      data={data}
      margin={{ top: 12, right: 18, left: 8, bottom: 15 }}
      barCategoryGap="16%"
    >
      <BarChartGradients data={data} />
      <CartesianGrid vertical={false} stroke={colors.gridColor} />
      <BarChartXAxis
        activeLabels={activeLabels}
        colors={colors}
        hasSelection={hasSelection}
        index={index}
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={36}
        tick={{ fontSize: 11, fill: colors.secondaryTickColor }}
      />
      <Tooltip
        cursor={{ fill: colors.cursorFill }}
        formatter={(
          value: number | string,
          _name: string,
          item: TooltipPayloadItem,
        ) => [
          valueFormatter(Number(value || 0)),
          String(item?.payload?.[index] || ""),
        ]}
        labelFormatter={() => ""}
        contentStyle={colors.tooltipStyle}
        itemStyle={colors.tooltipTextStyle}
        labelStyle={colors.tooltipTextStyle}
      />
      <Bar
        dataKey={category}
        radius={[0, 0, 0, 0]}
        maxBarSize={18}
        isAnimationActive={focusedValue === null}
        animationDuration={320}
        onClick={(entry: unknown) => {
          if (isBarChartDatum(entry) && entry.rawValue) {
            onValueChange?.(entry);
          }
        }}
      >
        {data.map((row) => (
          <Cell
            key={row.rawValue}
            fill={getBarCellFill(row, focusedValue)}
            fillOpacity={
              focusedValue === row.rawValue
                ? 1
                : hasSelection
                  ? row.isActive
                    ? 1
                    : 0.46
                  : 1
            }
            stroke={
              focusedValue === row.rawValue || row.isActive
                ? colors.activeStrokeColor
                : colors.strokeColor
            }
            strokeWidth={focusedValue === row.rawValue ? 2.5 : 1}
            style={getBarCellStyle(focusedValue === row.rawValue)}
          />
        ))}
      </Bar>
    </RechartsBarChart>
  );
}

function getBarCellFill(row: BarChartDatum, focusedValue: string | null) {
  return focusedValue === row.rawValue || row.isActive
    ? row.activeColor || row.color
    : row.color;
}

function BarChartGradients({ data }) {
  return (
    <defs>
      {data.map((row) =>
        row.gradientId && row.gradientStops ? (
          <linearGradient
            key={row.gradientId}
            id={row.gradientId}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            {row.gradientStops.map((stopColor, stopIndex) => (
              <stop
                key={`${row.gradientId}-${stopIndex}`}
                offset={`${(stopIndex / Math.max(row.gradientStops.length - 1, 1)) * 100}%`}
                stopColor={stopColor}
              />
            ))}
          </linearGradient>
        ) : null,
      )}
    </defs>
  );
}

function BarChartXAxis({ activeLabels, colors, hasSelection, index }) {
  return (
    <XAxis
      dataKey={index}
      tickLine={false}
      axisLine={false}
      interval={0}
      tickMargin={12}
      height={58}
      tick={({ x = 0, y = 0, payload = {} }: AxisTickProps): ReactElement => (
        <g transform={`translate(${x},${y})`}>
          <text
            x={0}
            y={0}
            dy={12}
            textAnchor="end"
            fill={
              hasSelection && activeLabels.has(payload.value)
                ? colors.selectedTickColor
                : colors.tickColor
            }
            fontSize={11}
            fontWeight={
              hasSelection && activeLabels.has(payload.value) ? 900 : 400
            }
            transform="rotate(-42)"
          >
            {payload.value}
          </text>
        </g>
      )}
    />
  );
}

function getBarCellStyle(isFocused: boolean): CSSProperties {
  return {
    cursor: "pointer",
    filter: isFocused
      ? getChartFocusFilter({ blur: 5, brightness: 1.08 })
      : undefined,
    transition:
      "filter 180ms ease, fill-opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease",
  };
}

function BarChartA11yButtons({ data, index, onFocusValue, onValueChange }) {
  return data.map((row) => (
    <button
      key={row.rawValue}
      type="button"
      aria-label={`${row.groupLabel}: ${row[index]}`}
      onBlur={() => onFocusValue(null)}
      onClick={() => onValueChange?.(row)}
      onFocus={() => onFocusValue(row.rawValue)}
    />
  ));
}

export default BarChart;
