import { Box, Stack, Typography } from "@mui/material";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { tooltipStyle, tooltipTextStyle } from "./chartUtils.js";

function DonutChart({
  data,
  category,
  index,
  valueFormatter,
  onValueChange,
  activeValues = [],
  className
}) {
  const hasSelection = activeValues.length > 0;

  return (
    <Box
      className={className}
      sx={{
        height: { xs: "auto", sm: 300 },
        minWidth: 0,
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1fr) minmax(150px, 0.55fr)" },
        gridTemplateRows: { xs: "240px auto", sm: "minmax(0, 1fr)" },
        gap: 2,
        alignItems: "center",
        overflow: "hidden",
        "& .recharts-surface:focus, & .recharts-surface:focus-visible, & .recharts-sector:focus, & .recharts-sector:focus-visible, & [tabindex]:focus, & [tabindex]:focus-visible": {
          outline: "none"
        }
      }}
    >
      <Box sx={{ height: "100%", minWidth: 0, overflow: "hidden" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
            <Tooltip
              formatter={(value, _name, item) => [
                valueFormatter(Number(value || 0)),
                item?.payload?.[index] || ""
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
              onClick={(entry) => {
                if (entry?.isOther || !entry?.rawValue) {
                  return;
                }
                onValueChange?.(entry);
              }}
            >
              {data.map((row) => (
                <Cell
                  key={row.rawValue}
                  fill={row.color}
                  fillOpacity={row.isOther ? 0.34 : (hasSelection ? (row.isActive ? 1 : 0.42) : 0.92)}
                  stroke={row.isActive ? "rgba(0,0,0,0.42)" : "rgba(0,0,0,0.22)"}
                  strokeWidth={1}
                  style={{
                    cursor: row.isOther ? "default" : "pointer",
                    transition: "fill-opacity 180ms ease, stroke 180ms ease, stroke-width 180ms ease"
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </Box>
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
          overflow: "hidden"
        }}
      >
        {data.filter((row) => !row.isOther).map((row) => (
          <Stack
            key={row.rawValue}
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              minWidth: 0,
              maxWidth: "100%",
              flex: { xs: "0 1 auto", sm: "0 1 auto" }
            }}
          >
            <Box
              component="span"
              sx={{
                width: 12,
                height: 12,
                borderRadius: "999px",
                bgcolor: row.legendColor || row.color,
                flexShrink: 0
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
                opacity: hasSelection ? (row.isActive ? 1 : 0.62) : 1
              }}
            >
              {row[index]}
            </Typography>
          </Stack>
        ))}
      </Stack>
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
        {data.map((row) => row.isOther ? null : (
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

export default DonutChart;
