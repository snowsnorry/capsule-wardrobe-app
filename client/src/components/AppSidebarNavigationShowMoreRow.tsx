import { Button } from "@mui/material";
import {
  topLevelIconRailWidth,
  type Translate,
} from "./AppSidebarNavigationRows";

export function ShowMoreRow({
  count,
  disabled,
  onClick,
  t,
}: {
  count: number;
  disabled: boolean;
  onClick: () => void;
  t: Translate;
}) {
  return (
    <Button
      disabled={disabled}
      onClick={onClick}
      sx={{
        justifyContent: "flex-start",
        minHeight: 34,
        pl: topLevelIconRailWidth,
        pr: 2,
        py: 0.5,
        width: "100%",
        borderRadius: "var(--cw-radius-card)",
        color: "text.secondary",
        fontSize: "14px",
        fontWeight: 600,
        textTransform: "none",
      }}
    >
      {t("sidebar.showMore", { count })}
    </Button>
  );
}
