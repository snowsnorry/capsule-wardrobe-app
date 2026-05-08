import { Box, Stack, Typography, useTheme } from "@mui/material";
import type { CSSProperties } from "react";
import { Cell, Pie, PieChart, Tooltip } from "recharts";
import { getTooltipStyle, getTooltipTextStyle } from "./chartUtils";
import ChartContainer from "./ChartContainer";

type DonutChartDatum = {
  rawValue: string;
  color: string;
  groupLabel: string;
  isActive?: boolean;
  isOther?: boolean;
  legendColor?: string;
  [key: string]: string | number | boolean | undefined;
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
  const hasSelection = activeValues.length > 0;
  const strokeColor = isDarkMode
    ? "rgba(238, 245, 243, 0.34)"
    : "rgba(31, 41, 51, 0.22)";
  const activeStrokeColor = isDarkMode
    ? "rgba(238, 245, 243, 0.56)"
    : "rgba(31, 41, 51, 0.42)";
  const tooltipStyle = getTooltipStyle(isDarkMode);
  const tooltipTextStyle = getTooltipTextStyle(isDarkMode);

  return (
    <Box
      className={className}
      sx={{
        height: { xs: "auto", sm: 300 },
        display: "grid",
        gridTemplateColumns: {
          xs: "minmax(0, 1fr)",
          sm: "minmax(0, 1fr) minmax(150px, 0.55fr)",
        },
        gridTemplateRows: { xs: "240px auto", sm: "minmax(0, 1fr)" },
        gap: 2,
        alignItems: "center",
        overflow: "hidden",
        "& .recharts-surface:focus, & .recharts-surface:focus-visible, & .recharts-sector:focus, & .recharts-sector:focus-visible, & [tabindex]:focus, & [tabindex]:focus-visible":
          {
            outline: "none",
          },
      }}
    >
      <ChartContainer
        renderChart={({ width, height }) => (
          <DonutPie
            activeStrokeColor={activeStrokeColor}
            category={category}
            data={data}
            hasSelection={hasSelection}
            height={height}
            index={index}
            onValueChange={onValueChange}
            strokeColor={strokeColor}
            tooltipStyle={tooltipStyle}
            tooltipTextStyle={tooltipTextStyle}
            valueFormatter={valueFormatter}
            width={width}
          />
        )}
        sx={{ height: "100%", minWidth: 0, overflow: "hidden" }}
      />
      <DonutLegend data={data} hasSelection={hasSelection} index={index} />
      <DonutA11yButtons
        data={data}
        index={index}
        onValueChange={onValueChange}
      />
    </Box>
  );
}

function DonutPie({
  activeStrokeColor,
  category,
  data,
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
        isAnimationActive
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
            fill={row.color}
            fillOpacity={
              row.isOther
                ? 0.34
                : hasSelection
                  ? row.isActive
                    ? 1
                    : 0.42
                  : 0.92
            }
            stroke={row.isActive ? activeStrokeColor : strokeColor}
            strokeWidth={1}
            style={getDonutCellStyle(row)}
          />
        ))}
      </Pie>
    </PieChart>
  );
}

function getDonutCellStyle(row: DonutChartDatum): CSSProperties {
  return {
    cursor: row.isOther ? "default" : "pointer",
    transition:
      "fill-opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease",
  };
}

function DonutLegend({ data, hasSelection, index }) {
  return (
    <Stack
      spacing={{ xs: 0, sm: 0.85 }}
      direction={{ xs: "row", sm: "column" }}
      useFlexGap
      sx={{
        minWidth: 0,
        display: "flex",
        flexWrap: { xs: "wrap", sm: "nowrap" },
        gap: { xs: 1.1, sm: 0.85 },
        alignItems: { xs: "center", sm: "stretch" },
        alignContent: "flex-start",
        overflow: "hidden",
      }}
    >
      {data
        .filter((row) => !row.isOther)
        .map((row) => (
          <DonutLegendItem
            key={row.rawValue}
            hasSelection={hasSelection}
            index={index}
            row={row}
          />
        ))}
    </Stack>
  );
}

function DonutLegendItem({ hasSelection, index, row }) {
  return (
    <Stack
      key={row.rawValue}
      direction="row"
      spacing={1}
      alignItems="center"
      sx={{
        minWidth: 0,
        maxWidth: "100%",
        flex: { xs: "0 1 auto", sm: "0 1 auto" },
      }}
    >
      <Box
        component="span"
        sx={{
          width: 12,
          height: 12,
          borderRadius: "999px",
          bgcolor: row.legendColor || row.color,
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

function DonutA11yButtons({ data, index, onValueChange }) {
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
            onClick={() => onValueChange?.(row)}
          />
        ),
      )}
    </Box>
  );
}

export default DonutChart;
