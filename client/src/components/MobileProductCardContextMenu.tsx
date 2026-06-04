import type { ReactElement, ReactNode } from "react";
import type { MouseEvent } from "react";
import { useCallback, useEffect, useId, useState } from "react";
import { Dialog, DialogTitle, MenuList, Paper, Stack } from "@mui/material";
import ClothingCard from "./ClothingCard";
import type {
  ClothingCardItem,
  MobileContextMenuOriginRect,
} from "./ClothingCardTypes";

type MobileProductCardContextMenuProps = {
  actions: ReactNode;
  item: ClothingCardItem | null;
  label: string;
  open: boolean;
  originRect?: MobileContextMenuOriginRect;
  onClose: () => void;
};

const CONTEXT_MENU_MORPH_DURATION_MS = 220;
const CONTEXT_MENU_ACTION_REVEAL_DELAY_MS = 80;

function MobileProductCardContextMenu({
  actions,
  item,
  label,
  open,
  originRect,
  onClose,
}: MobileProductCardContextMenuProps): ReactElement | null {
  const titleId = useId();
  const [previewElement, setPreviewElement] = useState<HTMLDivElement | null>(
    null,
  );
  const [showActions, setShowActions] = useState(!originRect);
  const revealActions = useCallback(() => setShowActions(true), []);
  const hideActions = useCallback(() => setShowActions(false), []);

  useMobileContextMenuMorph({
    open,
    originRect,
    previewElement,
    onActionsReady: revealActions,
    onActionsHidden: hideActions,
  });

  if (!item) {
    return null;
  }

  return (
    <Dialog
      aria-labelledby={titleId}
      open={open}
      onClose={onClose}
      maxWidth={false}
      BackdropProps={{ sx: contextMenuBackdropSx }}
      PaperProps={{ sx: contextMenuDialogPaperSx }}
    >
      <Stack
        spacing={1.25}
        onContextMenu={suppressNativeContextMenu}
        sx={contextMenuContentSx}
      >
        <DialogTitle id={titleId} sx={visuallyHiddenSx}>
          {label}
        </DialogTitle>
        <Paper ref={setPreviewElement} elevation={0} sx={contextMenuPreviewSx}>
          <ClothingCard
            item={item}
            disableImageGestures
            isMobile
            mobileColumns={1}
            showProductMenu={false}
          />
        </Paper>
        <Paper elevation={0} sx={contextMenuActionsSx(showActions)}>
          <MenuList autoFocusItem={open} sx={{ py: 0.5 }}>
            {actions}
          </MenuList>
        </Paper>
      </Stack>
    </Dialog>
  );
}

function useMobileContextMenuMorph({
  open,
  originRect,
  previewElement,
  onActionsReady,
  onActionsHidden,
}: {
  open: boolean;
  originRect?: MobileContextMenuOriginRect;
  previewElement: HTMLDivElement | null;
  onActionsReady: () => void;
  onActionsHidden: () => void;
}) {
  useEffect(() => {
    if (!open) {
      onActionsHidden();
      return undefined;
    }

    if (!originRect) {
      onActionsReady();
      return undefined;
    }

    onActionsHidden();
    if (!previewElement) {
      return undefined;
    }

    let animation: Animation | null = null;
    let actionTimer: number | null = null;
    const frameId = window.requestAnimationFrame(() => {
      if (
        prefersReducedMotion() ||
        typeof previewElement.animate !== "function"
      ) {
        onActionsReady();
        return;
      }

      const targetRect = previewElement.getBoundingClientRect();
      if (targetRect.width === 0 || targetRect.height === 0) {
        onActionsReady();
        return;
      }

      animation = previewElement.animate(
        [
          {
            transform: buildOriginTransform(originRect, targetRect),
            transformOrigin: "top left",
          },
          {
            transform: "translate3d(0, 0, 0) scale(1, 1)",
            transformOrigin: "top left",
          },
        ],
        {
          duration: CONTEXT_MENU_MORPH_DURATION_MS,
          easing: "cubic-bezier(0.2, 0, 0, 1)",
          fill: "both",
        },
      );
      actionTimer = window.setTimeout(
        onActionsReady,
        CONTEXT_MENU_ACTION_REVEAL_DELAY_MS,
      );
      animation.finished
        .then(() => {
          onActionsReady();
          animation?.cancel();
        })
        .catch(() => onActionsReady());
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      if (actionTimer !== null) {
        window.clearTimeout(actionTimer);
      }
      animation?.cancel();
    };
  }, [onActionsHidden, onActionsReady, open, originRect, previewElement]);
}

function prefersReducedMotion() {
  return (
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
  );
}

function buildOriginTransform(
  originRect: MobileContextMenuOriginRect,
  targetRect: DOMRect,
) {
  const scaleX = originRect.width / targetRect.width;
  const scaleY = originRect.height / targetRect.height;
  const translateX = originRect.left - targetRect.left;
  const translateY = originRect.top - targetRect.top;

  return `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
}

function suppressNativeContextMenu(event: MouseEvent<HTMLElement>) {
  event.preventDefault();
}

const contextMenuBackdropSx = {
  bgcolor: "rgba(15, 23, 42, 0.46)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
} as const;

const contextMenuDialogPaperSx = {
  width: "min(360px, calc(100vw - 40px))",
  m: 0,
  border: 0,
  bgcolor: "transparent",
  backgroundImage: "none",
  borderRadius: 0,
  boxShadow: "none",
  overflow: "visible",
} as const;

const contextMenuContentSx = {
  width: "100%",
  outline: 0,
} as const;

const visuallyHiddenSx = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: 1,
  m: -1,
  overflow: "hidden",
  p: 0,
  position: "absolute",
  whiteSpace: "nowrap",
  width: 1,
} as const;

const contextMenuPreviewSx = {
  border: 0,
  borderRadius: "var(--cw-radius-detail)",
  boxShadow: "var(--cw-shadow-overlay-panel)",
  overflow: "hidden",
  bgcolor: "transparent",
  backgroundImage: "none",
  transformOrigin: "top left",
  willChange: "transform",
  "& .wardrobe-card-root, & img": {
    userSelect: "none",
    WebkitUserSelect: "none",
    WebkitTouchCallout: "none",
    touchAction: "none",
  },
} as const;

const contextMenuActionsSx = (showActions: boolean) =>
  ({
    borderRadius: "var(--cw-radius-detail)",
    boxShadow: "var(--cw-shadow-overlay-panel)",
    overflow: "hidden",
    bgcolor: "background.paper",
    border: "1px solid",
    borderColor: "divider",
    opacity: showActions ? 1 : 0,
    pointerEvents: showActions ? "auto" : "none",
    transform: showActions ? "translateY(0)" : "translateY(6px)",
    transition:
      "opacity 140ms cubic-bezier(0.2, 0, 0, 1), transform 140ms cubic-bezier(0.2, 0, 0, 1)",
    "@media (prefers-reduced-motion: reduce)": {
      transition: "none",
      transform: "none",
    },
  }) as const;

export default MobileProductCardContextMenu;
