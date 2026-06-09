import { useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import MobileProductCardContextMenu from "../../components/MobileProductCardContextMenu";
import type {
  MobileContextMenuOriginRect,
  ProductMenuPresentation,
} from "../../components/ClothingCardTypes";
import { getCanonicalItemUrl, isLikedItem } from "../../utils/likedItemState";
import { isSavedToWardrobe } from "../../utils/savedWardrobeState";
import type { CapsuleMenuAnchor, MainScreenItem } from "./MainScreenTypes";

type ProductMenuState = {
  anchor: CapsuleMenuAnchor;
  url: string;
  item: MainScreenItem | null;
  originRect?: MobileContextMenuOriginRect;
  presentation?: ProductMenuPresentation;
};

type ProductMenuProps = {
  menuProps: {
    productMenu: ProductMenuState;
    props: {
      onRemoveFromPersonalItems?: (
        item: MainScreenItem,
      ) => Promise<void> | void;
      onSaveToPersonalItems?: (item: MainScreenItem) => Promise<void> | void;
      onSetItemLike?: (
        item: MainScreenItem,
        isLiked: boolean,
      ) => Promise<void> | void;
      onToggleRegenerationSelection: (item: MainScreenItem) => void;
      selectedAnchorItemRefs?: Array<{
        source: "uploaded" | "from_catalog";
        url: string;
      }>;
    };
    setSelectionMode: (value: boolean) => void;
  };
  onClose: () => void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductMenu({ menuProps, onClose, t }: ProductMenuProps) {
  const [removeConfirmItem, setRemoveConfirmItem] =
    useState<MainScreenItem | null>(null);
  const savedToWardrobe = isSavedToWardrobe(menuProps.productMenu.item, {
    includeWardrobeSource: true,
  });
  const renderActions = () => (
    <ProductMenuItems
      menuProps={menuProps}
      savedToWardrobe={savedToWardrobe}
      t={t}
      onClose={onClose}
      onRequestRemove={setRemoveConfirmItem}
    />
  );
  const isMobileContextMenu =
    menuProps.productMenu.presentation === "mobile-context";

  return (
    <>
      <Menu
        anchorEl={menuProps.productMenu.anchor}
        open={Boolean(menuProps.productMenu.anchor) && !isMobileContextMenu}
        onClose={onClose}
      >
        {renderActions()}
      </Menu>
      <MobileProductCardContextMenu
        actions={renderActions()}
        item={menuProps.productMenu.item}
        label={t("capsule.openProductMenu")}
        open={Boolean(menuProps.productMenu.anchor) && isMobileContextMenu}
        originRect={menuProps.productMenu.originRect}
        onClose={onClose}
      />
      <ProductRemoveConfirmDialog
        item={removeConfirmItem}
        t={t}
        onClose={() => setRemoveConfirmItem(null)}
        onConfirm={(item) => menuProps.props.onRemoveFromPersonalItems?.(item)}
      />
    </>
  );
}

function ProductMenuItems({
  menuProps,
  onClose,
  onRequestRemove,
  savedToWardrobe,
  t,
}: ProductMenuProps & {
  onRequestRemove: (item: MainScreenItem) => void;
  savedToWardrobe: boolean;
}) {
  const isUploadedItem = menuProps.productMenu.item?.source === "uploaded";

  return (
    <>
      <RegenerationMenuItem menuProps={menuProps} onClose={onClose} t={t} />
      <LikeMenuItem menuProps={menuProps} onClose={onClose} t={t} />
      {isUploadedItem ? null : (
        <>
          <WardrobeMenuItem
            menuProps={menuProps}
            savedToWardrobe={savedToWardrobe}
            t={t}
            onClose={onClose}
            onRequestRemove={onRequestRemove}
          />
          <CopyProductLinkMenuItem
            menuProps={menuProps}
            onClose={onClose}
            t={t}
          />
        </>
      )}
    </>
  );
}

function LikeMenuItem({ menuProps, onClose, t }: ProductMenuProps) {
  const item = menuProps.productMenu.item;
  const isLiked = isLikedItem(item);
  const itemUrl = getCanonicalItemUrl(item);
  if (!item || !itemUrl || !menuProps.props.onSetItemLike) {
    return null;
  }

  return (
    <MenuItem
      onClick={() => {
        onClose();
        void menuProps.props.onSetItemLike?.(item, !isLiked);
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

function isAnchorMenuItem(menuProps: ProductMenuProps["menuProps"]) {
  const anchorRefs = menuProps.props.selectedAnchorItemRefs || [];
  const anchorRefSet = new Set(
    anchorRefs
      .map((ref) =>
        ref.url ? `${ref.source}\u0000${String(ref.url).trim()}` : "",
      )
      .filter(Boolean),
  );
  const item = menuProps.productMenu.item;

  if (!item) {
    return false;
  }
  const itemUrl = String(item.url || "").trim();
  const source = item.source === "uploaded" ? "uploaded" : "from_catalog";
  return Boolean(itemUrl && anchorRefSet.has(`${source}\u0000${itemUrl}`));
}

function RegenerationMenuItem({ menuProps, onClose, t }: ProductMenuProps) {
  const isAnchor = isAnchorMenuItem(menuProps);
  const menuItem = (
    <MenuItem
      disabled={isAnchor}
      onClick={() => {
        const item = menuProps.productMenu.item;
        onClose();
        if (item) {
          menuProps.setSelectionMode(true);
          menuProps.props.onToggleRegenerationSelection(item);
        }
      }}
    >
      <ListItemIcon>
        <ThumbDownAltOutlinedIcon fontSize="small" />
      </ListItemIcon>
      <ListItemText>{t("capsule.selectProductForRegeneration")}</ListItemText>
    </MenuItem>
  );

  return isAnchor ? (
    <Tooltip title={t("capsule.anchorRegenerationLocked")}>
      <span>{menuItem}</span>
    </Tooltip>
  ) : (
    menuItem
  );
}

function WardrobeMenuItem({
  menuProps,
  onClose,
  onRequestRemove,
  savedToWardrobe,
  t,
}: ProductMenuProps & {
  onRequestRemove: (item: MainScreenItem) => void;
  savedToWardrobe: boolean;
}) {
  return (
    <MenuItem
      onClick={() => {
        const item = menuProps.productMenu.item;
        onClose();
        if (!item) return;
        if (savedToWardrobe) {
          onRequestRemove(item);
          return;
        }
        void menuProps.props.onSaveToPersonalItems?.(item);
      }}
    >
      <ListItemIcon>
        {savedToWardrobe ? (
          <BookmarkRemoveOutlinedIcon fontSize="small" />
        ) : (
          <BookmarkBorderRoundedIcon fontSize="small" />
        )}
      </ListItemIcon>
      <ListItemText>
        {t(
          savedToWardrobe
            ? "capsule.removeFromPersonalItems"
            : "capsule.saveToPersonalItems",
        )}
      </ListItemText>
    </MenuItem>
  );
}

function CopyProductLinkMenuItem({ menuProps, onClose, t }: ProductMenuProps) {
  return (
    <MenuItem
      onClick={() => {
        const url = menuProps.productMenu.url;
        onClose();
        void navigator.clipboard?.writeText(url);
      }}
    >
      {t("capsule.copyProductLinkAddress")}
    </MenuItem>
  );
}

function ProductRemoveConfirmDialog({
  item,
  onClose,
  onConfirm,
  t,
}: {
  item: MainScreenItem | null;
  onClose: () => void;
  onConfirm: (item: MainScreenItem) => Promise<void> | void | undefined;
  t: ProductMenuProps["t"];
}) {
  return (
    <Dialog open={Boolean(item)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ pb: 1 }}>
        {t("wardrobe.removeConfirmTitle")}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t("wardrobe.removeConfirmBody")}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <Button
          color="error"
          variant="contained"
          onClick={() => {
            const nextItem = item;
            onClose();
            if (nextItem) {
              void onConfirm(nextItem);
            }
          }}
        >
          {t("wardrobe.removeConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProductMenu;
