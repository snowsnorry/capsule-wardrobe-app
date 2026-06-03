import { useTheme } from "@mui/material";
import {
  CartesianGrid,
  Area,
  AreaChart as RechartsLineChart,
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
  const colors = getChartTheme(isDarkMode);
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
          <CartesianGrid vertical={false} stroke={colors.gridColor} />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            height={58}
            tick={{ fontSize: 11, fill: colors.secondaryTickColor }}
          />
          <YAxis
            width="auto"
            tick={{ fontSize: 11, fill: colors.secondaryTickColor }}
          />
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
            stroke={colors.seriesPrimary}
            fill={colors.seriesPrimary}
            strokeWidth={1}
            dot={false}
            activeDot={{
              r: 5,
              stroke: colors.activeDotStroke,
              strokeWidth: 2,
              fill: colors.seriesPrimary,
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
          filter: getChartFocusFilter({ blur: 5, brightness: 1.08 }),
          strokeWidth: 3,
        },
      }}
    />
  );
}

export default LineChart;
