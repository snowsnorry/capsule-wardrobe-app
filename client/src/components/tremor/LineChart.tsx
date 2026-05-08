import { useTheme } from "@mui/material";
import {
  CartesianGrid,
  Area,
  AreaChart as RechartsLineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getTooltipStyle, getTooltipTextStyle } from "./chartUtils";
import ChartContainer from "./ChartContainer";

type LineChartDatum = {
  [key: string]: string | number | undefined;
};

type TooltipPayloadItem = {
  payload?: LineChartDatum;
};

type LineChartProps = {
  data: LineChartDatum[];
  index: string;
  category: string;
  valueFormatter: (value: number) => string;
  labelFormatter?: (payload?: LineChartDatum) => string;
};

function LineChart({
  data,
  index,
  category,
  valueFormatter,
  labelFormatter,
}: LineChartProps) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const gridColor = isDarkMode
    ? "rgba(238, 245, 243, 0.14)"
    : "rgba(148, 163, 184, 0.16)";
  const tickColor = isDarkMode ? "rgba(238, 245, 243, 0.78)" : "#667085";
  const areaColor = isDarkMode ? "#49a3a3" : "#1c7c7c";
  const tooltipStyle = getTooltipStyle(isDarkMode);
  const tooltipTextStyle = getTooltipTextStyle(isDarkMode);

  return (
    <ChartContainer
      renderChart={({ width, height }) => (
        <RechartsLineChart
          width={width}
          height={height}
          data={data}
          margin={{ top: 24, right: 24, left: 8, bottom: 15 }}
        >
          <CartesianGrid vertical={false} stroke={gridColor} />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            height={58}
            tick={{ fontSize: 11, fill: tickColor }}
          />
          <YAxis width="auto" tick={{ fontSize: 11, fill: tickColor }} />
          <Tooltip
            formatter={(
              value: number | string,
              _name: string,
              item: TooltipPayloadItem,
            ) => [
              valueFormatter(Number(value || 0)),
              labelFormatter?.(item?.payload) ||
                `${item?.payload?.[index] || ""} EUR`,
            ]}
            labelFormatter={() => ""}
            contentStyle={tooltipStyle}
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
          />
          <Area
            className="tremor-line-chart-area"
            type="monotone"
            dataKey={category}
            stroke={areaColor}
            fill={areaColor}
            strokeWidth={1}
            dot={false}
            activeDot={{
              r: 5,
              stroke: isDarkMode ? "#15201f" : "#fffdf9",
              strokeWidth: 2,
              fill: areaColor,
            }}
            isAnimationActive
            animationDuration={320}
          />
        </RechartsLineChart>
      )}
      sx={{
        height: 360,
        "& .recharts-surface:focus": {
          outline: "none",
        },
        "& .recharts-surface:focus-visible .recharts-area-area": {
          filter: "brightness(1.08)",
          opacity: 0.42,
        },
        "& .recharts-surface:focus-visible .recharts-area-curve": {
          filter:
            "drop-shadow(0 0 5px rgba(28, 124, 124, 0.55)) brightness(1.08)",
          strokeWidth: 3,
        },
      }}
    />
  );
}

export default LineChart;
