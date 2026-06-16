import { Box } from "@mui/material";
import type {
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";

type ClothingCardRootProps = {
  children: ReactNode;
  isMobile: boolean;
  mobileColumns: 1 | 2 | 3;
  isSelected: boolean;
  showCardActions: boolean;
  label: string;
  onCardClick?: () => void;
  onContextMenuOpen?: (anchor: HTMLElement) => void;
  onPointerCancel?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  isPressing: boolean;
};

function ClothingCardRoot({
  children,
  isMobile,
  mobileColumns,
  isSelected,
  showCardActions,
  label,
  onCardClick,
  onContextMenuOpen,
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  isPressing,
}: ClothingCardRootProps) {
  const isInteractive = typeof onCardClick === "function";
  const handleKeyDown = createCardKeyDownHandler({
    onCardClick,
    onContextMenuOpen,
  });

  return (
    <Box
      className="wardrobe-card-root"
      data-mobile-columns={mobileColumns}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      aria-label={isInteractive ? label : undefined}
      aria-haspopup={onContextMenuOpen ? "menu" : undefined}
      aria-keyshortcuts={onContextMenuOpen ? "Shift+F10" : undefined}
      onClick={onCardClick}
      onKeyDown={handleKeyDown}
      onContextMenu={createContextMenuHandler(onContextMenuOpen)}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerLeave={onPointerLeave}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      sx={getCardRootSx({
        isDenseMobileCard: isMobile && mobileColumns !== 1,
        showCardActions,
        isSelected,
        isMobile,
        isInteractive,
        isPressing,
      })}
    >
      {children}
    </Box>
  );
}

function createContextMenuHandler(
  onContextMenuOpen?: (anchor: HTMLElement) => void,
) {
  if (!onContextMenuOpen) {
    return undefined;
  }

  return (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    onContextMenuOpen(event.currentTarget);
  };
}

function createCardKeyDownHandler({
  onCardClick,
  onContextMenuOpen,
}: {
  onCardClick?: () => void;
  onContextMenuOpen?: (anchor: HTMLElement) => void;
}) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (isKeyboardContextMenuEvent(event) && onContextMenuOpen) {
      event.preventDefault();
      onContextMenuOpen(event.currentTarget);
      return;
    }

    if (onCardClick && isKeyboardClickEvent(event)) {
      event.preventDefault();
      onCardClick();
    }
  };
}

function isKeyboardContextMenuEvent(event: KeyboardEvent<HTMLDivElement>) {
  return event.key === "ContextMenu" || (event.shiftKey && event.key === "F10");
}

function isKeyboardClickEvent(event: KeyboardEvent<HTMLDivElement>) {
  return event.key === "Enter" || event.key === " ";
}

function getCardTransformTransition(isPressing: boolean) {
  if (isPressing) {
    return "transform 520ms linear, box-shadow 180ms ease";
  }

  return "transform 140ms cubic-bezier(0.2, 0, 0, 1), box-shadow 180ms ease";
}

function getCardRootSx({
  isDenseMobileCard,
  showCardActions,
  isSelected,
  isMobile,
  isInteractive,
  isPressing,
}: {
  isDenseMobileCard: boolean;
  showCardActions: boolean;
  isSelected: boolean;
  isMobile: boolean;
  isInteractive: boolean;
  isPressing: boolean;
}) {
  return {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    borderRadius: isDenseMobileCard ? 0 : "var(--cw-radius-card)",
    overflow: "hidden",
    backgroundColor: "var(--cw-color-product-card-bg)",
    position: "relative",
    border: isDenseMobileCard
      ? "0.5px solid var(--cw-color-product-dense-border)"
      : "1px solid var(--cw-color-product-border)",
    boxShadow: isDenseMobileCard ? "none" : "var(--cw-shadow-wardrobe-card)",
    cursor: isInteractive ? "pointer" : "default",
    transform: isPressing ? "scale(0.94)" : "scale(1)",
    transformOrigin: "center",
    transition: getCardTransformTransition(isPressing),
    ...getMobileCardGestureSuppressionSx(isMobile),
    willChange: isPressing ? "transform" : undefined,
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
      transform: "none",
    },
    "&:focus-visible": isInteractive
      ? {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: 3,
        }
      : undefined,
    ...(showCardActions && !isSelected && !isMobile
      ? {
          "& .wardrobe-card-actions": {
            opacity: 0,
            visibility: "hidden",
          },
          "&:hover .wardrobe-card-actions, &:focus-within .wardrobe-card-actions":
            {
              opacity: 0.72,
              visibility: "visible",
            },
        }
      : {}),
  } as const;
}

function getMobileCardGestureSuppressionSx(isMobile: boolean) {
  if (!isMobile) {
    return {};
  }

  return {
    touchAction: "manipulation",
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
  };
}

export { ClothingCardRoot };
