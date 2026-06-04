import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";

function getCountBadgeLabel(countBadge: number | null | undefined) {
  if (typeof countBadge !== "number" || !Number.isFinite(countBadge)) {
    return null;
  }
  return String(Math.max(0, Math.trunc(countBadge)));
}

function TopLevelCountBadge({
  count,
  isActive,
}: {
  count: string;
  isActive: boolean;
}) {
  return (
    <Box
      className="sidebar-top-level-count-badge"
      component="span"
      sx={{
        alignItems: "center",
        bgcolor: (theme) =>
          isActive
            ? alpha(theme.palette.primary.main, 0.14)
            : theme.palette.action.hover,
        borderRadius: "var(--cw-radius-card)",
        color: isActive ? "primary.main" : "text.primary",
        display: "inline-flex",
        flexShrink: 0,
        fontSize: "0.875rem",
        fontVariantNumeric: "tabular-nums",
        fontWeight: 700,
        height: 32,
        justifyContent: "center",
        lineHeight: 1,
        minWidth: 32,
        ml: 1,
        mr: 0.75,
        px: 1,
      }}
    >
      {count}
    </Box>
  );
}

export { getCountBadgeLabel, TopLevelCountBadge };
