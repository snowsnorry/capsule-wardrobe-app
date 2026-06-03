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
import MobileProductCardContextMenu from "../components/MobileProductCardContextMenu";
import type { ProductMenuPresentation } from "../components/ClothingCardTypes";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type MyWardrobeProductMenuState = {
  anchor: HTMLElement | null;
  url: string;
  item: MainScreenItem | null;
  presentation?: ProductMenuPresentation;
};

type MyWardrobeProductMenuProps = {
  anchor: HTMLElement | null;
  item: MainScreenItem | null;
  presentation?: ProductMenuPresentation;
  onClose: () => void;
  onRequestRemove: (item: MainScreenItem) => void;
  t: (key: string) => string;
};

type MyWardrobeRemoveConfirmDialogProps = {
  item: MainScreenItem | null;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: (item: MainScreenItem) => Promise<void> | void;
  t: (key: string) => string;
};

function MyWardrobeProductMenu({
  anchor,
  item,
  presentation,
  onClose,
  onRequestRemove,
  t,
}: MyWardrobeProductMenuProps): ReactElement {
  const renderActions = () => (
    <MyWardrobeProductMenuItems
      item={item}
      t={t}
      onClose={onClose}
      onRequestRemove={onRequestRemove}
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
        onClose={onClose}
      />
    </>
  );
}

function MyWardrobeProductMenuItems({
  item,
  onClose,
  onRequestRemove,
  t,
}: Omit<MyWardrobeProductMenuProps, "anchor" | "presentation">): ReactElement {
  const isUploaded = item?.source === "uploaded";

  return (
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
            ? "myWardrobe.deleteUploaded"
            : "capsule.removeFromMyWardrobe",
        )}
      </ListItemText>
    </MenuItem>
  );
}

function MyWardrobeRemoveConfirmDialog({
  item,
  isLoading = false,
  onClose,
  onConfirm,
  t,
}: MyWardrobeRemoveConfirmDialogProps): ReactElement {
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
            ? "myWardrobe.deleteUploadedConfirmTitle"
            : "myWardrobe.removeConfirmTitle",
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
              ? "myWardrobe.deleteUploadedConfirmBody"
              : "myWardrobe.removeConfirmBody",
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
              ? "myWardrobe.deleteUploadedConfirm"
              : "myWardrobe.removeConfirm",
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export { MyWardrobeProductMenu, MyWardrobeRemoveConfirmDialog };
export type { MyWardrobeProductMenuState };
