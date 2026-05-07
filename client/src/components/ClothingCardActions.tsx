import { IconButton, Stack } from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import type { CardActionProps } from "./ClothingCardTypes";

const mobileProductMenuSx = {
  "& .wardrobe-card-product-menu.MuiIconButton-root": {
    width: 34,
    height: 34,
    border: 0,
    borderRadius: "999px",
    bgcolor: "transparent",
    color: "rgba(31, 41, 55, 0.72)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: "none",
    "&:hover": {
      bgcolor: "rgba(255, 255, 255, 0.68)",
      color: "rgba(17, 24, 39, 0.78)",
    },
  },
} as const;

function getActionOffset({
  showMobileProductMenuButton,
  isMobile,
  mobileCardMetrics,
}: Pick<
  CardActionProps,
  "showMobileProductMenuButton" | "isMobile" | "mobileCardMetrics"
>) {
  if (showMobileProductMenuButton) {
    return 0;
  }

  return isMobile ? mobileCardMetrics.actionOffset : 12;
}

function getRegenerateButtonSx(isSelected: boolean) {
  const backgroundColor = isSelected
    ? "rgba(17, 17, 17, 0.92)"
    : "rgba(17, 17, 17, 0.42)";
  const hoverBackgroundColor = isSelected
    ? "rgba(17, 17, 17, 0.96)"
    : "rgba(17, 17, 17, 0.62)";
  const color = isSelected ? "#d24343" : "#fff";

  return {
    bgcolor: backgroundColor,
    color,
    "&:hover": { bgcolor: hoverBackgroundColor },
    "&.Mui-disabled": { color, bgcolor: backgroundColor },
  } as const;
}

function getActionStackSx(props: CardActionProps) {
  const actionOffset = getActionOffset(props);
  const actionOpacity = props.showMobileProductMenuButton
    ? 1
    : props.showActionButtons
      ? 0.72
      : undefined;

  return {
    position: "absolute",
    top: actionOffset,
    right: actionOffset,
    zIndex: 4,
    opacity: actionOpacity,
    visibility: props.showActionButtons ? "visible" : undefined,
    transition: "opacity 160ms ease, visibility 160ms ease",
    "&:hover, &:focus-within": { opacity: 1 },
    "& .wardrobe-card-action-button": {
      width: 36,
      height: 36,
      bgcolor: "rgba(17, 17, 17, 0.42)",
      color: "#fff",
      transition: "background-color 160ms ease, color 160ms ease",
      "&:hover": { bgcolor: "rgba(17, 17, 17, 0.62)" },
      "&.Mui-disabled": {
        color: "#fff",
        bgcolor: "rgba(17, 17, 17, 0.42)",
        opacity: props.showActionButtons ? 0.72 : 0,
      },
    },
    ...(props.showMobileProductMenuButton ? mobileProductMenuSx : {}),
    "& .wardrobe-card-regenerate.MuiIconButton-root": getRegenerateButtonSx(
      props.isSelected,
    ),
  } as const;
}

function CardActions(props: CardActionProps) {
  return (
    <Stack
      className="wardrobe-card-actions"
      direction="row"
      spacing={props.isMobile ? 0.5 : 0.75}
      sx={getActionStackSx(props)}
    >
      {props.showToggleButton ? (
        <IconButton
          aria-label={props.t("main.partialRegenerateToggle")}
          className="wardrobe-card-action-button wardrobe-card-regenerate"
          onMouseDown={props.stopPropagation}
          onPointerDown={props.stopPropagation}
          onClick={props.onToggleSelected}
          disabled={props.isRegenerating}
        >
          <ThumbDownAltOutlinedIcon fontSize="small" />
        </IconButton>
      ) : null}
      {props.showProductMenuButton ? (
        <IconButton
          aria-label={props.t("capsule.openProductMenu")}
          className="wardrobe-card-action-button wardrobe-card-product-menu"
          onMouseDown={props.stopPropagation}
          onPointerDown={props.stopPropagation}
          onClick={props.onProductMenuClick}
        >
          <MoreVertRoundedIcon fontSize="small" />
        </IconButton>
      ) : null}
    </Stack>
  );
}

export { CardActions };
export type { CardActionProps } from "./ClothingCardTypes";
