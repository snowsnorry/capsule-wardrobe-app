import { IconButton, Stack } from "@mui/material";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import type { CardActionProps } from "./ClothingCardTypes";

const mobileProductMenuSx = {
  "& .wardrobe-card-product-menu.MuiIconButton-root": {
    width: 44,
    height: 44,
    border: 0,
    borderRadius: "var(--cw-radius-pill)",
    bgcolor: "transparent",
    color: "var(--cw-color-mobile-image-action-ink)",
    backdropFilter: "none",
    WebkitBackdropFilter: "none",
    boxShadow: "none",
    "&:hover": {
      bgcolor: "var(--cw-color-mobile-image-action-bg-hover)",
      color: "var(--cw-color-mobile-image-action-ink-hover)",
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
    ? "var(--cw-color-on-image-action-bg-selected)"
    : "var(--cw-color-on-image-action-bg)";
  const hoverBackgroundColor = isSelected
    ? "var(--cw-color-on-image-action-bg-selected-hover)"
    : "var(--cw-color-on-image-action-bg-hover)";
  const color = isSelected
    ? "error.main"
    : "var(--cw-color-on-image-action-ink)";

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
      width: 44,
      height: 44,
      bgcolor: "var(--cw-color-on-image-action-bg)",
      color: "var(--cw-color-on-image-action-ink)",
      transition: "background-color 160ms ease, color 160ms ease",
      "&:hover": { bgcolor: "var(--cw-color-on-image-action-bg-hover)" },
      "&.Mui-disabled": {
        color: "var(--cw-color-on-image-action-ink)",
        bgcolor: "var(--cw-color-on-image-action-bg)",
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
