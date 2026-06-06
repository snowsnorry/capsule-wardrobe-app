import type { ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import MobileProductCardContextMenu from "../components/MobileProductCardContextMenu";
import type {
  MobileContextMenuOriginRect,
  ProductMenuPresentation,
} from "../components/ClothingCardTypes";
import { getCanonicalItemUrl, isLikedItem } from "../utils/likedItemState";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeProductMenuState = {
  anchor: HTMLElement | null;
  url: string;
  item: MainScreenItem | null;
  originRect?: MobileContextMenuOriginRect;
  presentation?: ProductMenuPresentation;
};

type WardrobeProductMenuProps = {
  anchor: HTMLElement | null;
  item: MainScreenItem | null;
  originRect?: MobileContextMenuOriginRect;
  presentation?: ProductMenuPresentation;
  onClose: () => void;
  onRequestRemove: (item: MainScreenItem) => void;
  onSetItemLike?: (
    item: MainScreenItem,
    isLiked: boolean,
  ) => Promise<void> | void;
  t: (key: string) => string;
};

type WardrobeRemoveConfirmDialogProps = {
  item: MainScreenItem | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (item: MainScreenItem) => Promise<void> | void;
  t: (key: string) => string;
};

function WardrobeProductMenu({
  anchor,
  item,
  originRect,
  presentation,
  onClose,
  onRequestRemove,
  onSetItemLike,
  t,
}: WardrobeProductMenuProps): ReactElement {
  const renderActions = () => (
    <WardrobeProductMenuItems
      item={item}
      t={t}
      onClose={onClose}
      onRequestRemove={onRequestRemove}
      onSetItemLike={onSetItemLike}
    />
  );
  const isMobileContextMenu = presentation === "mobile-context";

  return (
    <>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor) && !isMobileContextMenu}
        onClose={onClose}
      >
        {renderActions()}
      </Menu>
      <MobileProductCardContextMenu
        actions={renderActions()}
        item={item}
        label={t("capsule.openProductMenu")}
        open={Boolean(anchor) && isMobileContextMenu}
        originRect={originRect}
        onClose={onClose}
      />
    </>
  );
}

function WardrobeProductMenuItems({
  item,
  onClose,
  onRequestRemove,
  onSetItemLike,
  t,
}: Omit<WardrobeProductMenuProps, "anchor" | "presentation">): ReactElement {
  const isUploaded = item?.source === "uploaded";

  return (
    <>
      <LikeMenuItem
        item={item}
        t={t}
        onClose={onClose}
        onSetItemLike={onSetItemLike}
      />
      <MenuItem
        onClick={() => {
          onClose();
          if (item) {
            onRequestRemove(item);
          }
        }}
      >
        <ListItemIcon>
          {isUploaded ? (
            <DeleteOutlineRoundedIcon fontSize="small" />
          ) : (
            <BookmarkRemoveOutlinedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {t(
            isUploaded
              ? "wardrobe.deleteUploaded"
              : "capsule.removeFromMyWardrobe",
          )}
        </ListItemText>
      </MenuItem>
    </>
  );
}

function LikeMenuItem({
  item,
  onClose,
  onSetItemLike,
  t,
}: {
  item: MainScreenItem | null;
  onClose: () => void;
  onSetItemLike?: WardrobeProductMenuProps["onSetItemLike"];
  t: WardrobeProductMenuProps["t"];
}) {
  const itemUrl = getCanonicalItemUrl(item);
  const isLiked = isLikedItem(item);
  if (!item || !itemUrl || !onSetItemLike) {
    return null;
  }

  return (
    <MenuItem
      onClick={() => {
        onClose();
        void onSetItemLike(item, !isLiked);
      }}
    >
      <ListItemIcon>
        {isLiked ? (
          <FavoriteRoundedIcon fontSize="small" />
        ) : (
          <FavoriteBorderRoundedIcon fontSize="small" />
        )}
      </ListItemIcon>
      <ListItemText>
        {t(isLiked ? "wardrobe.removeLike" : "wardrobe.like")}
      </ListItemText>
    </MenuItem>
  );
}

function WardrobeRemoveConfirmDialog({
  item,
  isLoading = false,
  onClose,
  onConfirm,
  t,
}: WardrobeRemoveConfirmDialogProps): ReactElement {
  const isUploaded = item?.source === "uploaded";

  return (
    <Dialog
      open={Boolean(item)}
      onClose={() => {
        if (!isLoading) {
          onClose();
        }
      }}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>
        {t(
          isUploaded
            ? "wardrobe.deleteUploadedConfirmTitle"
            : "wardrobe.removeConfirmTitle",
        )}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        {isLoading ? (
          <LinearProgress
            color="success"
            aria-label={t("capsule.removeFromMyWardrobe")}
            sx={{ mb: 2 }}
          />
        ) : null}
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t(
            isUploaded
              ? "wardrobe.deleteUploadedConfirmBody"
              : "wardrobe.removeConfirmBody",
          )}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button disabled={isLoading} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={isLoading}
          onClick={() => {
            const nextItem = item;
            if (nextItem) {
              void Promise.resolve(onConfirm(nextItem)).finally(onClose);
            }
          }}
        >
          {t(
            isUploaded
              ? "wardrobe.deleteUploadedConfirm"
              : "wardrobe.removeConfirm",
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { WardrobeProductMenu, WardrobeRemoveConfirmDialog };
export type { WardrobeProductMenuState };
