import type { ReactElement, ReactNode } from "react";
import type { MouseEvent } from "react";
import { useId } from "react";
import { Dialog, DialogTitle, MenuList, Paper, Stack } from "@mui/material";
import ClothingCard from "./ClothingCard";
import type { ClothingCardItem } from "./ClothingCardTypes";

type MobileProductCardContextMenuProps = {
  actions: ReactNode;
  item: ClothingCardItem | null;
  label: string;
  open: boolean;
  onClose: () => void;
};

function MobileProductCardContextMenu({
  actions,
  item,
  label,
  open,
  onClose,
}: MobileProductCardContextMenuProps): ReactElement | null {
  const titleId = useId();

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
        <Paper elevation={0} sx={contextMenuPreviewSx}>
          <ClothingCard
            item={item}
            isMobile
            mobileColumns={1}
            showProductMenu={false}
          />
        </Paper>
        <Paper elevation={0} sx={contextMenuActionsSx}>
          <MenuList autoFocusItem={open} sx={{ py: 0.5 }}>
            {actions}
          </MenuList>
        </Paper>
      </Stack>
    </Dialog>
  );
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
  bgcolor: "transparent",
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
  borderRadius: "var(--cw-radius-detail)",
  boxShadow: "var(--cw-shadow-overlay-panel)",
  overflow: "hidden",
  bgcolor: "var(--cw-color-product-card-bg)",
} as const;

const contextMenuActionsSx = {
  borderRadius: "var(--cw-radius-detail)",
  boxShadow: "var(--cw-shadow-overlay-panel)",
  overflow: "hidden",
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
} as const;

export default MobileProductCardContextMenu;
