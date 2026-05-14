import { useState } from "react";
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import BookmarkRemoveOutlinedIcon from "@mui/icons-material/BookmarkRemoveOutlined";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import type { SearchResultItem } from "./searchTypes";

type ProductActionsMenuProps = {
  item: SearchResultItem;
  isSavedToWardrobe: boolean;
  onRemoveFromMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
  onSaveToMyWardrobe: (item: SearchResultItem) => Promise<void> | void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductActionsMenu({
  item,
  isSavedToWardrobe,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
  t,
}: ProductActionsMenuProps) {
  const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);
  const isMenuOpen = Boolean(menuAnchorEl);
  const closeMenu = () => setMenuAnchorEl(null);

  const handleWardrobeMenuAction = () => {
    closeMenu();
    if (isSavedToWardrobe) {
      setIsRemoveConfirmOpen(true);
      return;
    }
    void onSaveToMyWardrobe(item);
  };

  return (
    <>
      <IconButton
        aria-label={t("search.productActions")}
        aria-controls={isMenuOpen ? "catalog-product-menu" : undefined}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen ? "true" : undefined}
        onClick={(event) => setMenuAnchorEl(event.currentTarget)}
        sx={{ mr: -1, flexShrink: 0 }}
      >
        <MoreVertRoundedIcon />
      </IconButton>
      <Menu
        id="catalog-product-menu"
        anchorEl={menuAnchorEl}
        open={isMenuOpen}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem onClick={handleWardrobeMenuAction}>
          <ListItemIcon>
            {isSavedToWardrobe ? (
              <BookmarkRemoveOutlinedIcon fontSize="small" />
            ) : (
              <BookmarkBorderRoundedIcon fontSize="small" />
            )}
          </ListItemIcon>
          <ListItemText>
            {t(
              isSavedToWardrobe
                ? "capsule.removeFromMyWardrobe"
                : "capsule.saveToMyWardrobe",
            )}
          </ListItemText>
        </MenuItem>
      </Menu>
      <Dialog
        open={isRemoveConfirmOpen}
        onClose={() => setIsRemoveConfirmOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ pb: 1 }}>
          {t("myWardrobe.removeConfirmTitle")}
        </DialogTitle>
        <DialogContent sx={{ pt: 0.5, pb: 0 }}>
          <DialogContentText sx={{ color: "text.secondary" }}>
            {t("myWardrobe.removeConfirmBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
          <Button onClick={() => setIsRemoveConfirmOpen(false)}>
            {t("actions.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              setIsRemoveConfirmOpen(false);
              void onRemoveFromMyWardrobe?.(item);
            }}
          >
            {t("myWardrobe.removeConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default ProductActionsMenu;
