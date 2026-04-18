import { Box, useTheme } from "@mui/material";
import {
  CartesianGrid,
  Area,
  AreaChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getTooltipStyle, getTooltipTextStyle } from "./chartUtils";

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

function LineChart({ data, index, category, valueFormatter, labelFormatter }: LineChartProps) {
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const gridColor = isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(148, 163, 184, 0.16)";
  const tickColor = isDarkMode ? "rgba(255,255,255,0.78)" : "#667085";
  const areaColor = isDarkMode ? "#a78bfa" : "#8884d8";
  const tooltipStyle = getTooltipStyle(isDarkMode);
  const tooltipTextStyle = getTooltipTextStyle(isDarkMode);

  return (
    <Box
      sx={{
        height: 360,
        minWidth: 0,
        "& .recharts-surface:focus, & .recharts-surface:focus-visible, & [tabindex]:focus, & [tabindex]:focus-visible": {
          outline: "none"
        }
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsLineChart data={data} margin={{ top: 24, right: 24, left: 8, bottom: 15 }}>
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
            formatter={(value: number | string, _name: string, item: TooltipPayloadItem) => [
              valueFormatter(Number(value || 0)),
              labelFormatter?.(item?.payload) || `${item?.payload?.[index] || ""} EUR`
            ]}
            labelFormatter={() => ""}
            contentStyle={tooltipStyle}
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
          />
          <Area
            type="monotone"
            dataKey={category}
            stroke={areaColor}
            fill={areaColor}
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: areaColor }}
            isAnimationActive
            animationDuration={320}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default LineChart;
