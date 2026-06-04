import { Box, Stack, Typography, useTheme } from "@mui/material";
import type { CSSProperties } from "react";
import { useState } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import {
  getChartFocusFilter,
  getChartTheme,
  getTooltipStyle,
  getTooltipTextStyle,
} from "./chartUtils";
import ChartContainer from "./ChartContainer";

type DonutChartDatum = {
  rawValue: string;
  color: string;
  activeColor?: string;
  groupLabel: string;
  isActive?: boolean;
  isOther?: boolean;
  legendColor?: string;
  [key: string]: string | number | boolean | string[] | undefined;
};

type TooltipPayloadItem = {
  payload?: Record<string, unknown>;
};

type DonutChartProps = {
  data: DonutChartDatum[];
  category: string;
  index: string;
  valueFormatter: (value: number) => string;
  onValueChange?: (row: DonutChartDatum) => void;
  activeValues?: string[];
  className?: string;
};

function isDonutChartDatum(value: unknown): value is DonutChartDatum {
  return typeof value === "object" && value !== null && "rawValue" in value;
}

function DonutChart({
  data,
  category,
  index,
  valueFormatter,
  onValueChange,
  activeValues = [],
  className,
}: DonutChartProps) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const [focusedValue, setFocusedValue] = useState<string | null>(null);
  const hasSelection = activeValues.length > 0;
  const colors = getChartTheme(isDarkMode);
  const tooltipStyle = getTooltipStyle(isDarkMode);
  const tooltipTextStyle = getTooltipTextStyle(isDarkMode);
  const visibleLegendCount = data.filter((row) => !row.isOther).length;
  const hasDenseLegend = visibleLegendCount > 8;

  return (
    <Box
      className={className}
      sx={{
        height: { xs: "auto", sm: 300 },
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: hasDenseLegend
            ? "minmax(0, 1fr) minmax(240px, 0.8fr)"
            : "minmax(0, 1fr) minmax(150px, 0.55fr)",
        },
        gridTemplateRows: { xs: "240px auto", sm: "minmax(0, 1fr)" },
        gap: 2,
        alignItems: "center",
        overflow: "hidden",
        "& .recharts-surface:focus": {
          outline: "none",
        },
        "& .recharts-surface:focus-visible .recharts-pie-sector": {
          filter: getChartFocusFilter({
            blur: 5,
            glow: colors.focusSoftGlow,
            brightness: 1.04,
          }),
        },
      }}
    >
      <ChartContainer
        renderChart={({ width, height }) => (
          <DonutPie
            activeStrokeColor={colors.activeStrokeColor}
            category={category}
            data={data}
            focusedValue={focusedValue}
            hasSelection={hasSelection}
            height={height}
            index={index}
            onValueChange={onValueChange}
            strokeColor={colors.strokeColor}
            tooltipStyle={tooltipStyle}
            tooltipTextStyle={tooltipTextStyle}
            valueFormatter={valueFormatter}
            width={width}
          />
        )}
        sx={{ height: "100%", minWidth: 0, overflow: "hidden" }}
      />
      <DonutLegend
        data={data}
        hasDenseLegend={hasDenseLegend}
        hasSelection={hasSelection}
        index={index}
      />
      <DonutA11yButtons
        data={data}
        index={index}
        onFocusValue={setFocusedValue}
        onValueChange={onValueChange}
      />
    </Box>
  );
}

function DonutPie({
  activeStrokeColor,
  category,
  data,
  focusedValue,
  hasSelection,
  height,
  index,
  onValueChange,
  strokeColor,
  tooltipStyle,
  tooltipTextStyle,
  valueFormatter,
  width,
}) {
  return (
    <PieChart
      width={width}
      height={height}
      margin={{ top: 16, right: 16, bottom: 16, left: 16 }}
    >
      <Tooltip
        isAnimationActive={false}
        formatter={(
          value: number | string,
          _name: string,
          item: TooltipPayloadItem,
        ) => [
          valueFormatter(Number(value || 0)),
          String(item?.payload?.[index] || ""),
        ]}
        contentStyle={tooltipStyle}
        itemStyle={tooltipTextStyle}
        labelStyle={tooltipTextStyle}
      />
      <Pie
        data={data}
        dataKey={category}
        nameKey={index}
        cx="50%"
        cy="50%"
        innerRadius="56%"
        outerRadius="82%"
        paddingAngle={data.length > 1 ? 1.5 : 0}
        strokeWidth={1}
        isAnimationActive={focusedValue === null}
        animationDuration={320}
        onClick={(entry: unknown) => {
          if (isDonutChartDatum(entry) && !entry.isOther && entry.rawValue) {
            onValueChange?.(entry);
          }
        }}
      >
        {data.map((row) => (
          <Cell
            key={row.rawValue}
            fill={
              focusedValue === row.rawValue || row.isActive
                ? row.activeColor || row.color
                : row.color
            }
            fillOpacity={
              focusedValue === row.rawValue
                ? 1
                : row.isOther
                  ? 0.34
                  : hasSelection
                    ? row.isActive
                      ? 1
                      : 0.42
                    : 0.92
            }
            stroke={
              focusedValue === row.rawValue || row.isActive
                ? activeStrokeColor
                : strokeColor
            }
            strokeWidth={focusedValue === row.rawValue ? 2.5 : 1}
            style={getDonutCellStyle(row, focusedValue === row.rawValue)}
          />
        ))}
      </Pie>
    </PieChart>
  );
}

function getDonutCellStyle(
  row: DonutChartDatum,
  isFocused: boolean,
): CSSProperties {
  return {
    cursor: row.isOther ? "default" : "pointer",
    filter: isFocused
      ? getChartFocusFilter({ blur: 6, brightness: 1.08 })
      : undefined,
    transition:
      "filter 180ms ease, fill-opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease",
  };
}

function DonutLegend({ data, hasDenseLegend, hasSelection, index }) {
  const visibleRows = data.filter((row) => !row.isOther);

  return (
    <Box
      data-testid="donut-legend"
      data-density={hasDenseLegend ? "dense" : "regular"}
      sx={{
        minWidth: 0,
        display: { xs: "flex", sm: "grid" },
        flexWrap: "wrap",
        gridTemplateColumns: {
          sm: hasDenseLegend ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)",
        },
        columnGap: { xs: 1.1, sm: hasDenseLegend ? 1.6 : 0 },
        rowGap: { xs: 1.1, sm: 0.85 },
        alignItems: { xs: "center", sm: "stretch" },
        alignContent: "flex-start",
        overflow: "hidden",
      }}
    >
      {visibleRows.map((row) => (
        <DonutLegendItem
          key={row.rawValue}
          hasSelection={hasSelection}
          index={index}
          row={row}
        />
      ))}
    </Box>
  );
}

function DonutLegendItem({ hasSelection, index, row }) {
  return (
    <Stack
      key={row.rawValue}
      direction="row"
      spacing={1}
      sx={{
        alignItems: "center",
        minWidth: 0,
        maxWidth: "100%",
        width: "100%",
        flex: { xs: "0 1 auto", sm: "0 1 auto" },
      }}
    >
      <Box
        component="span"
        sx={{
          width: 12,
          height: 12,
          borderRadius: "999px",
          bgcolor: row.isActive
            ? row.activeColor || row.legendColor || row.color
            : row.legendColor || row.color,
          flexShrink: 0,
        }}
      />
      <Typography
        variant="body2"
        sx={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          color: row.isActive ? "text.primary" : "text.secondary",
          fontWeight: row.isActive ? 700 : 500,
          opacity: hasSelection ? (row.isActive ? 1 : 0.62) : 1,
        }}
      >
        {row[index]}
      </Typography>
    </Stack>
  );
}

function DonutA11yButtons({ data, index, onFocusValue, onValueChange }) {
  return (
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
      {data.map((row) =>
        row.isOther ? null : (
          <button
            key={row.rawValue}
            type="button"
            aria-label={`${row.groupLabel}: ${row[index]}`}
            onBlur={() => onFocusValue(null)}
            onClick={() => onValueChange?.(row)}
            onFocus={() => onFocusValue(row.rawValue)}
          />
        ),
      )}
    </Box>
  );
}

export default DonutChart;
