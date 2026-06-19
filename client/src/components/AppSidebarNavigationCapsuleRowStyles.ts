import { topLevelIconRailWidth } from "./AppSidebarNavigationRows";

const capsulePinSlotSx = {
  alignItems: "center",
  display: "flex",
  height: "100%",
  justifyContent: "center",
  left: 0,
  opacity: 0,
  pointerEvents: "none",
  position: "absolute",
  top: 0,
  transition: "opacity 160ms ease",
  width: topLevelIconRailWidth,
};

const capsulePinButtonSx = {
  alignItems: "center",
  display: "inline-flex",
  justifyContent: "center",
  width: 28,
  height: 28,
  minWidth: 0,
  flexShrink: 0,
  color: "text.secondary",
  "& svg": { fontSize: 18 },
};

function capsuleActionsSlotSx(isOverlaySidebar: boolean) {
  return {
    display: "flex",
    position: isOverlaySidebar ? "static" : "absolute",
    right: 0,
    flex: "0 0 auto",
    opacity: isOverlaySidebar ? 1 : 0,
    width: isOverlaySidebar ? 32 : 0,
    height: 32,
    minWidth: 0,
    overflow: "hidden",
    pointerEvents: isOverlaySidebar ? "auto" : "none",
    transform: isOverlaySidebar ? "translateX(0)" : "translateX(6px)",
    transition: "opacity 160ms ease, transform 180ms ease",
  };
}

function getCapsuleRowTransformTransition(isPressing: boolean) {
  if (isPressing) {
    return "transform 520ms linear";
  }

  return "transform 140ms cubic-bezier(0.2, 0, 0, 1)";
}

export function capsuleRowSx(isOverlaySidebar: boolean, isPressing = false) {
  return {
    borderRadius: "var(--cw-radius-card)",
    mb: 0.25,
    ml: 0,
    pl: topLevelIconRailWidth,
    pr: 0,
    minHeight: 34,
    py: 0.5,
    columnGap: 0.5,
    position: "relative",
    transform: isPressing ? "scale(0.94)" : "scale(1)",
    transformOrigin: "center",
    transition: getCapsuleRowTransformTransition(isPressing),
    willChange: isPressing ? "transform" : undefined,
    width: "100%",
    "& .capsule-row-unsaved-dot": {
      opacity: 1,
      width: 10,
      mr: 0.75,
      transition: "opacity 160ms ease, width 180ms ease, margin 180ms ease",
    },
    "& .capsule-row-pin-slot": capsulePinSlotSx,
    "& .capsule-row-pin-slot[data-pinned='true']": {
      opacity: 1,
      pointerEvents: "auto",
    },
    "&:hover .capsule-row-pin-slot, &:focus-within .capsule-row-pin-slot": {
      opacity: 1,
      pointerEvents: "auto",
    },
    "& .capsule-row-pin": capsulePinButtonSx,
    "& .capsule-row-text": {
      pr: 0,
      transition: "padding-right 180ms ease",
    },
    "& .capsule-row-actions-slot": capsuleActionsSlotSx(isOverlaySidebar),
    "&:hover .capsule-row-unsaved-dot, &:focus-within .capsule-row-unsaved-dot":
      {
        opacity: 0,
        width: 0,
        mr: 0,
      },
    "&:hover .capsule-row-text, &:focus-within .capsule-row-text": {
      pr: 4,
    },
    "& .capsule-row-actions": {
      width: 32,
      height: 32,
      minWidth: 0,
      flexShrink: 0,
    },
    "&:hover .capsule-row-actions-slot, &:focus-within .capsule-row-actions-slot":
      {
        opacity: 1,
        width: 32,
        transform: "translateX(0)",
        pointerEvents: "auto",
      },
    "@media (prefers-reduced-motion: reduce)": {
      transform: "none",
      transition: "none",
      "& .capsule-row-unsaved-dot, & .capsule-row-text, & .capsule-row-actions-slot, & .capsule-row-pin-slot":
        {
          transition: "none",
          transform: "none",
        },
    },
  };
}
