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
} from "@mui/material";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import { isSavedToWardrobe } from "../../utils/savedWardrobeState";
import type { CapsuleMenuAnchor, MainScreenItem } from "./MainScreenTypes";

type ProductMenuState = {
  anchor: CapsuleMenuAnchor;
  url: string;
  item: MainScreenItem | null;
};

type ProductMenuProps = {
  menuProps: {
    productMenu: ProductMenuState;
    props: {
      onRemoveFromMyWardrobe?: (item: MainScreenItem) => Promise<void> | void;
      onSaveToMyWardrobe?: (item: MainScreenItem) => Promise<void> | void;
      onToggleRegenerationSelection: (item: MainScreenItem) => void;
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

  return (
    <>
      <Menu
        anchorEl={menuProps.productMenu.anchor}
        open={Boolean(menuProps.productMenu.anchor)}
        onClose={onClose}
      >
        <ProductMenuItems
          menuProps={menuProps}
          savedToWardrobe={savedToWardrobe}
          t={t}
          onClose={onClose}
          onRequestRemove={setRemoveConfirmItem}
        />
      </Menu>
      <ProductRemoveConfirmDialog
        item={removeConfirmItem}
        t={t}
        onClose={() => setRemoveConfirmItem(null)}
        onConfirm={(item) => menuProps.props.onRemoveFromMyWardrobe?.(item)}
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

function RegenerationMenuItem({ menuProps, onClose, t }: ProductMenuProps) {
  return (
    <MenuItem
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
        void menuProps.props.onSaveToMyWardrobe?.(item);
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
            ? "capsule.removeFromMyWardrobe"
            : "capsule.saveToMyWardrobe",
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
        {t("myWardrobe.removeConfirmTitle")}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t("myWardrobe.removeConfirmBody")}
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
          {t("myWardrobe.removeConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProductMenu;
