import type { ReactElement } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type MyWardrobeProductMenuState = {
  anchor: HTMLElement | null;
  url: string;
  item: MainScreenItem | null;
};

type MyWardrobeProductMenuProps = {
  anchor: HTMLElement | null;
  item: MainScreenItem | null;
  onClose: () => void;
  onRequestRemove: (item: MainScreenItem) => void;
  t: (key: string) => string;
};

type MyWardrobeRemoveConfirmDialogProps = {
  item: MainScreenItem | null;
  onClose: () => void;
  onConfirm: (item: MainScreenItem) => Promise<void> | void;
  t: (key: string) => string;
};

function MyWardrobeProductMenu({
  anchor,
  item,
  onClose,
  onRequestRemove,
  t,
}: MyWardrobeProductMenuProps): ReactElement {
  return (
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
      <MenuItem
        onClick={() => {
          onClose();
          if (item) {
            onRequestRemove(item);
          }
        }}
      >
        <ListItemIcon>
          <BookmarkRemoveOutlinedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.removeFromMyWardrobe")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}

function MyWardrobeRemoveConfirmDialog({
  item,
  onClose,
  onConfirm,
  t,
}: MyWardrobeRemoveConfirmDialogProps): ReactElement {
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

export { MyWardrobeProductMenu, MyWardrobeRemoveConfirmDialog };
export type { MyWardrobeProductMenuState };
