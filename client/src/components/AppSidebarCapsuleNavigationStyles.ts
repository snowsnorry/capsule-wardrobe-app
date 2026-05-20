const motionTransition = "opacity 180ms ease-in-out";
const expandedCapsuleChildrenMaxHeight = "calc(100vh - 260px)";
const capsuleChildrenContentInset = 4.5;
const capsuleRowTextInset = 1.5;

function getCapsuleRowSx(isOverlaySidebar: boolean) {
  return {
    borderRadius: "var(--cw-radius-card)",
    mb: 0.25,
    pl: capsuleChildrenContentInset,
    pr: capsuleRowTextInset,
    minHeight: 40,
    columnGap: 0.5,
    "& .capsule-row-unsaved-dot": {
      opacity: 1,
      transition: "opacity 120ms ease",
    },
    "& .capsule-row-actions": {
      opacity: isOverlaySidebar ? 1 : 0,
      width: 32,
      height: 32,
      minWidth: 0,
      p: 0.5,
      overflow: "hidden",
      pointerEvents: isOverlaySidebar ? "auto" : "none",
      transform: isOverlaySidebar ? "translateX(0)" : "translateX(6px)",
      transition: "opacity 160ms ease, transform 180ms ease",
    },
    ...(!isOverlaySidebar
      ? {
          "&:hover .capsule-row-unsaved-dot, &:focus-within .capsule-row-unsaved-dot":
            {
              opacity: 0,
            },
        }
      : {}),
    "&:hover .capsule-row-actions": {
      opacity: 1,
      transform: "translateX(0)",
      pointerEvents: "auto",
    },
    "&:focus-within .capsule-row-actions": {
      opacity: 1,
      transform: "translateX(0)",
      pointerEvents: "auto",
    },
    "@media (prefers-reduced-motion: reduce)": {
      "& .capsule-row-actions": {
        transition: "none",
        transform: "none",
      },
    },
  } as const;
}

function getCapsuleChildrenSx(showCapsuleChildren: boolean) {
  return {
    display: "grid",
    flex: "0 1 auto",
    minHeight: 0,
    maxHeight: showCapsuleChildren ? expandedCapsuleChildrenMaxHeight : "0px",
    gridTemplateRows: showCapsuleChildren ? "minmax(0, 1fr)" : "0fr",
    opacity: showCapsuleChildren ? 1 : 0,
    overflow: "hidden",
    transition: motionTransition,
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
    },
  } as const;
}

export { getCapsuleChildrenSx, getCapsuleRowSx };
