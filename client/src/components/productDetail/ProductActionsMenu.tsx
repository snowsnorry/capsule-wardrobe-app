import { useState } from "react";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import type { ProductDetailItem } from "./ProductDetailModel";

type ProductActionsMenuItem = ProductDetailItem;

type ProductActionsMenuProps = {
  item: ProductActionsMenuItem;
  isSavedToWardrobe: boolean;
  onRemoveFromMyWardrobe?: (
    item: ProductActionsMenuItem,
  ) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: ProductActionsMenuItem) => Promise<void> | void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

type WardrobeAction = (item: ProductActionsMenuItem) => Promise<void> | void;

function ProductActionsMenu({
  item,
  isSavedToWardrobe,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
  t,
}: ProductActionsMenuProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const [isActionPending, setIsActionPending] = useState(false);
  const isMenuOpen = Boolean(menuAnchorEl);
  const closeMenu = () => setMenuAnchorEl(null);

  const runWardrobeAction = async (action: WardrobeAction | undefined) => {
    if (!action || isActionPending) {
      return;
    }
    setIsActionPending(true);
    try {
      await action(item);
    } finally {
      setIsActionPending(false);
    }
  };

  const handleWardrobeMenuAction = () => {
    closeMenu();
    if (isSavedToWardrobe) {
      setIsRemoveConfirmOpen(true);
      return;
    }
    void runWardrobeAction(onSaveToMyWardrobe);
  };

  return (
    <>
      <ProductActionsIconButton
        isActionPending={isActionPending}
        isMenuOpen={isMenuOpen}
        isSavedToWardrobe={isSavedToWardrobe}
        t={t}
        onOpen={setMenuAnchorEl}
      />
      <ProductActionsDropdown
        anchorEl={menuAnchorEl}
        isActionPending={isActionPending}
        isMenuOpen={isMenuOpen}
        isSavedToWardrobe={isSavedToWardrobe}
        t={t}
        onClose={closeMenu}
        onWardrobeMenuAction={handleWardrobeMenuAction}
      />
      <ProductRemoveConfirmDialog
        isActionPending={isActionPending}
        open={isRemoveConfirmOpen}
        t={t}
        onClose={() => setIsRemoveConfirmOpen(false)}
        onConfirm={() => {
          void runWardrobeAction(onRemoveFromMyWardrobe).finally(() => {
            setIsRemoveConfirmOpen(false);
          });
        }}
      />
    </>
  );
}

function getWardrobeActionLabelKey(isSavedToWardrobe: boolean) {
  return isSavedToWardrobe
    ? "capsule.removeFromMyWardrobe"
    : "capsule.saveToMyWardrobe";
}

function ProductActionsIconButton({
  isActionPending,
  isMenuOpen,
  isSavedToWardrobe,
  onOpen,
  t,
}: {
  isActionPending: boolean;
  isMenuOpen: boolean;
  isSavedToWardrobe: boolean;
  onOpen: (anchor: HTMLElement | null) => void;
  t: ProductActionsMenuProps["t"];
}) {
  return (
    <Box sx={{ position: "relative", mr: -1, flexShrink: 0 }}>
      <IconButton
        aria-label={t("search.productActions")}
        aria-controls={isMenuOpen ? "catalog-product-menu" : undefined}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen ? "true" : undefined}
        disabled={isActionPending}
        onClick={(event) => onOpen(event.currentTarget)}
      >
        <MoreVertRoundedIcon />
      </IconButton>
      {isActionPending ? (
        <LinearProgress
          color="success"
          aria-label={t(getWardrobeActionLabelKey(isSavedToWardrobe))}
          sx={pendingIconProgressSx}
        />
      ) : null}
    </Box>
  );
}

function ProductActionsDropdown({
  anchorEl,
  isActionPending,
  isMenuOpen,
  isSavedToWardrobe,
  onClose,
  onWardrobeMenuAction,
  t,
}: {
  anchorEl: HTMLElement | null;
  isActionPending: boolean;
  isMenuOpen: boolean;
  isSavedToWardrobe: boolean;
  onClose: () => void;
  onWardrobeMenuAction: () => void;
  t: ProductActionsMenuProps["t"];
}) {
  return (
    <Menu
      id="catalog-product-menu"
      anchorEl={anchorEl}
      open={isMenuOpen}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      <MenuItem disabled={isActionPending} onClick={onWardrobeMenuAction}>
        <ListItemIcon>
          {isSavedToWardrobe ? (
            <BookmarkRemoveOutlinedIcon fontSize="small" />
          ) : (
            <BookmarkBorderRoundedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {t(getWardrobeActionLabelKey(isSavedToWardrobe))}
        </ListItemText>
      </MenuItem>
    </Menu>
  );
}

function ProductRemoveConfirmDialog({
  isActionPending,
  onClose,
  onConfirm,
  open,
  t,
}: {
  isActionPending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  open: boolean;
  t: ProductActionsMenuProps["t"];
}) {
  return (
    <Dialog
      open={open}
      onClose={() => {
        if (!isActionPending) {
          onClose();
        }
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>
        {t("myWardrobe.removeConfirmTitle")}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        {isActionPending ? (
          <LinearProgress
            color="success"
            aria-label={t("capsule.removeFromMyWardrobe")}
            sx={{ mb: 2 }}
          />
        ) : null}
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t("myWardrobe.removeConfirmBody")}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button disabled={isActionPending} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={isActionPending}
          onClick={onConfirm}
        >
          {t("myWardrobe.removeConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const pendingIconProgressSx = {
  position: "absolute",
  right: 8,
  bottom: 2,
  left: 8,
  borderRadius: 999,
} as const;

export default ProductActionsMenu;
