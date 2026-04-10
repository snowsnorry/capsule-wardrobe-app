import { Box, useTheme } from "@mui/material";
import {
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getTooltipStyle, getTooltipTextStyle } from "./chartUtils.js";

function BarChart({
  data,
  index,
  category,
  valueFormatter,
  onValueChange,
  activeValues = []
}) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const hasSelection = activeValues.length > 0;
  const activeLabels = new Set(data.filter((row) => row.isActive).map((row) => row[index]));
  const tickColor = isDarkMode ? "#f5f5f5" : "#475467";
  const secondaryTickColor = isDarkMode ? "rgba(255,255,255,0.76)" : "#667085";
  const gridColor = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(148, 163, 184, 0.16)";
  const strokeColor = isDarkMode ? "rgba(255,255,255,0.34)" : "rgba(0,0,0,0.22)";
  const activeStrokeColor = isDarkMode ? "rgba(255,255,255,0.56)" : "rgba(0,0,0,0.42)";
  const tooltipStyle = getTooltipStyle(isDarkMode);
  const tooltipTextStyle = getTooltipTextStyle(isDarkMode);

  return (
    <Box
      sx={{
        height: 360,
        minWidth: 0,
        "& .recharts-surface:focus, & .recharts-surface:focus-visible, & .recharts-rectangle:focus, & .recharts-rectangle:focus-visible, & [tabindex]:focus, & [tabindex]:focus-visible": {
          outline: "none"
        }
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart
          data={data}
          margin={{ top: 12, right: 18, left: 8, bottom: 15 }}
          barCategoryGap="16%"
        >
          <defs>
            {data.map((row) => (
              row.gradientId && row.gradientStops ? (
                <linearGradient key={row.gradientId} id={row.gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                  {row.gradientStops.map((stopColor, stopIndex) => (
                    <stop
                      key={`${row.gradientId}-${stopIndex}`}
                      offset={`${(stopIndex / Math.max(row.gradientStops.length - 1, 1)) * 100}%`}
                      stopColor={stopColor}
                    />
                  ))}
                </linearGradient>
              ) : null
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickMargin={12}
            height={58}
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <text
                  x={0}
                  y={0}
                  dy={12}
                  textAnchor="end"
                  fill={hasSelection && activeLabels.has(payload.value) ? "#ffffff" : tickColor}
                  fontSize={11}
                  fontWeight={hasSelection && activeLabels.has(payload.value) ? 900 : 400}
                  transform="rotate(-42)"
                >
                  {payload.value}
                </text>
              </g>
            )}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={36}
            tick={{ fontSize: 11, fill: secondaryTickColor }}
          />
          <Tooltip
            cursor={{ fill: "rgba(143,111,69,0.05)" }}
            formatter={(value, _name, item) => [
              valueFormatter(Number(value || 0)),
              item?.payload?.[index] || ""
            ]}
            labelFormatter={() => ""}
            contentStyle={tooltipStyle}
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
          />
          <Bar
            dataKey={category}
            radius={[0, 0, 0, 0]}
            maxBarSize={18}
            isAnimationActive
            animationDuration={320}
            onClick={(entry) => {
              if (entry?.rawValue) {
                onValueChange?.(entry);
              }
            }}
          >
            {data.map((row) => (
              <Cell
                key={row.rawValue}
                fill={row.color}
                fillOpacity={hasSelection ? (row.isActive ? 1 : 0.46) : 1}
                stroke={row.isActive ? activeStrokeColor : strokeColor}
                strokeWidth={1}
                style={{
                  cursor: "pointer",
                  transition: "fill-opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease"
                }}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
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
          border: 0
        }}
      >
        {data.map((row) => (
          <button
            key={row.rawValue}
            type="button"
            aria-label={`${row.groupLabel}: ${row[index]}`}
            onClick={() => onValueChange?.(row)}
          />
        ))}
      </Box>
    </Box>
  );
}

export default BarChart;
