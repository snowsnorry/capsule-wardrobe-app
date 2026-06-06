import { useState } from "react";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
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
import { isLikedItem } from "../../utils/likedItemState";
import type { ProductDetailItem } from "./ProductDetailModel";

type ProductActionsMenuItem = ProductDetailItem;

type ProductActionsMenuProps = {
  item: ProductActionsMenuItem;
  isSavedToWardrobe: boolean;
  onRemoveFromMyWardrobe?: (
    item: ProductActionsMenuItem,
  ) => Promise<void> | void;
  onEditUploadedWardrobeItem?: (item: ProductActionsMenuItem) => void;
  onSetItemLike?: (
    item: ProductActionsMenuItem,
    isLiked: boolean,
  ) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: ProductActionsMenuItem) => Promise<void> | void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

type WardrobeAction = (item: ProductActionsMenuItem) => Promise<void> | void;

function ProductActionsMenu({
  item,
  isSavedToWardrobe,
  onEditUploadedWardrobeItem,
  onSetItemLike,
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
  const handleLikeMenuAction = () => {
    closeMenu();
    void runWardrobeAction((currentItem) =>
      onSetItemLike?.(currentItem, !isLikedItem(currentItem)),
    );
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
        item={item}
        onLikeMenuAction={handleLikeMenuAction}
        showWardrobeAction={Boolean(
          onSaveToMyWardrobe || onRemoveFromMyWardrobe,
        )}
        showLikeAction={Boolean(onSetItemLike)}
        t={t}
        onClose={closeMenu}
        onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
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
  item,
  onClose,
  onEditUploadedWardrobeItem,
  onLikeMenuAction,
  onWardrobeMenuAction,
  showLikeAction,
  showWardrobeAction,
  t,
}: {
  anchorEl: HTMLElement | null;
  isActionPending: boolean;
  isMenuOpen: boolean;
  isSavedToWardrobe: boolean;
  item: ProductActionsMenuItem;
  onClose: () => void;
  onEditUploadedWardrobeItem?: ProductActionsMenuProps["onEditUploadedWardrobeItem"];
  onLikeMenuAction: () => void;
  onWardrobeMenuAction: () => void;
  showLikeAction: boolean;
  showWardrobeAction: boolean;
  t: ProductActionsMenuProps["t"];
}) {
  const showEdit = item.source === "uploaded" && onEditUploadedWardrobeItem;
  const showSaveRemove = item.source !== "uploaded" && showWardrobeAction;

  return (
    <Menu
      id="catalog-product-menu"
      anchorEl={anchorEl}
      open={isMenuOpen}
      onClose={onClose}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      transformOrigin={{ vertical: "top", horizontal: "right" }}
    >
      {showEdit ? (
        <MenuItem
          disabled={isActionPending}
          onClick={() => {
            onClose();
            onEditUploadedWardrobeItem(item);
          }}
        >
          <ListItemIcon>
            <EditOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("actions.edit")}</ListItemText>
        </MenuItem>
      ) : null}
      {showSaveRemove ? (
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
      ) : null}
      {showLikeAction ? (
        <MenuItem disabled={isActionPending} onClick={onLikeMenuAction}>
          <ListItemIcon>
            {isLikedItem(item) ? (
              <FavoriteRoundedIcon fontSize="small" />
            ) : (
              <FavoriteBorderRoundedIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {t(isLikedItem(item) ? "wardrobe.removeLike" : "wardrobe.like")}
          </ListItemText>
        </MenuItem>
      ) : null}
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
        {t("wardrobe.removeConfirmTitle")}
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
          {t("wardrobe.removeConfirmBody")}
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
          {t("wardrobe.removeConfirm")}
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
  borderRadius: "var(--cw-radius-pill)",
} as const;

export default ProductActionsMenu;
