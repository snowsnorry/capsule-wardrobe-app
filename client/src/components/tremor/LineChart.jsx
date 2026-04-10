import { Box } from "@mui/material";
import {
  CartesianGrid,
  Line,
  Area,
  AreaChart as RechartsLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { tooltipStyle, tooltipTextStyle } from "./chartUtils.js";

function LineChart({ data, index, category, valueFormatter, labelFormatter }) {
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
          <CartesianGrid vertical={false} stroke="rgba(148, 163, 184, 0.16)" />
          <XAxis
            dataKey={index}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
            height={58}
            tick={{ fontSize: 11, fill: "#667085" }}
          />
          <YAxis  width="auto" tick={{ fontSize: 11, fill: "#667085" }} />
          <Tooltip
            formatter={(value, _name, item) => [
              valueFormatter(Number(value || 0)),
              `${item?.payload?.[index]} EUR` || ""
            ]}
            labelFormatter={() => ""}
            contentStyle={tooltipStyle}
            itemStyle={tooltipTextStyle}
            labelStyle={tooltipTextStyle}
          />
          <Area
            type="monotone"
            dataKey={category}
            stroke="#8884d8"
            fill="#8884d8"
            strokeWidth={1}
            dot={false}
            activeDot={{ r: 5, stroke: "#ffffff", strokeWidth: 2, fill: "#8884d8" }}
            isAnimationActive
            animationDuration={320}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </Box>
  );
}

export default LineChart;
