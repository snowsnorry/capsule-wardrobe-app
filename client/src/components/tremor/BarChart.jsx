import { Box } from "@mui/material";
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
import { tooltipStyle, tooltipTextStyle } from "./chartUtils.js";

function BarChart({
  data,
  index,
  category,
  valueFormatter,
  onValueChange,
  activeValues = []
}) {
  const hasSelection = activeValues.length > 0;

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
          <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.16)" />
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
                  fill="#475467"
                  fontSize={11}
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
            tick={{ fontSize: 11, fill: "#667085" }}
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
                fillOpacity={hasSelection ? (row.isActive ? 1 : 0.46) : 0.96}
                stroke={row.isActive ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.22)"}
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
