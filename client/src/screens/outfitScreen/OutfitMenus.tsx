import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import FavoriteBorderRoundedIcon from "@mui/icons-material/FavoriteBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import MobileProductCardContextMenu from "../../components/MobileProductCardContextMenu";
import CardLayoutMenuSection from "../mainScreen/CapsuleActionMenuLayout";
import { getCanonicalItemUrl, isLikedItem } from "../../utils/likedItemState";
import type { OutfitItemSnapshot, OutfitMeta } from "../../app/appTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import type { ItemMenuState } from "./OutfitScreenTypes";

export function OutfitMenu({
  anchor,
  disabled,
  mobileCardColumns,
  outfit,
  onClose,
  onDelete,
  onDownload,
  onDuplicate,
  onMobileCardColumnsChange,
  onRevert,
  onSave,
  showCardLayout,
  t,
}: {
  anchor: HTMLElement | null;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  outfit: OutfitMeta | null;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDuplicate: () => void;
  onMobileCardColumnsChange: (value: MobileCardColumns) => void;
  onRevert: () => void;
  onSave: () => void;
  showCardLayout: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  return (
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
      <MenuItem disabled={disabled || !outfit?.id} onClick={onDownload}>
        <ListItemIcon>
          <DownloadRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.exportPdf")}</ListItemText>
      </MenuItem>
      <CardLayoutMenuSection
        show={showCardLayout}
        disabled={disabled}
        mobileCardColumns={mobileCardColumns}
        onClose={onClose}
        onMobileCardColumnsChange={onMobileCardColumnsChange}
      />
      <Divider />
      <MenuItem
        disabled={disabled || outfit?.status === "saved"}
        onClick={onRevert}
      >
        <ListItemIcon>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.revert")}</ListItemText>
      </MenuItem>
      <MenuItem
        disabled={disabled || outfit?.status === "saved"}
        onClick={onSave}
      >
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.save")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled || !outfit?.id} onClick={onDuplicate}>
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.saveAs")}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        disabled={disabled || !outfit?.id}
        onClick={onDelete}
        sx={{
          color: "error.main",
          "& .MuiListItemIcon-root": { color: "inherit" },
        }}
      >
        <ListItemIcon>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.delete")}</ListItemText>
      </MenuItem>
    </Menu>
  );
}

export function OutfitItemMenu({
  menu,
  onClose,
  onLike,
  onRemove,
  onSelect,
  t,
}: {
  menu: ItemMenuState;
  onClose: () => void;
  onLike: (entry: OutfitItemSnapshot) => void;
  onRemove: (entry: OutfitItemSnapshot) => void;
  onSelect: (entry: OutfitItemSnapshot) => void;
  t: (key: string) => string;
}) {
  const entry = menu.entry;
  const liked = isLikedItem(entry?.item);
  const renderActions = () => (
    <>
      <MenuItem
        onClick={() => {
          if (entry) onSelect(entry);
          onClose();
        }}
      >
        <ListItemIcon>
          <CheckRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("outfit.selectItem")}</ListItemText>
      </MenuItem>
      <MenuItem
        disabled={!entry || !getCanonicalItemUrl(entry.item)}
        onClick={() => {
          if (entry) onLike(entry);
          onClose();
        }}
      >
        <ListItemIcon>
          {liked ? (
            <FavoriteRoundedIcon fontSize="small" />
          ) : (
            <FavoriteBorderRoundedIcon fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>
          {t(liked ? "wardrobe.removeLike" : "wardrobe.like")}
        </ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        onClick={() => {
          if (entry) onRemove(entry);
          onClose();
        }}
        sx={{ color: "error.main" }}
      >
        <ListItemIcon sx={{ color: "inherit" }}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.delete")}</ListItemText>
      </MenuItem>
    </>
  );
  const isMobileContextMenu = menu.presentation === "mobile-context";

  return (
    <>
      <Menu
        anchorEl={menu.anchor}
        open={Boolean(menu.anchor) && !isMobileContextMenu}
        onClose={onClose}
      >
        {renderActions()}
      </Menu>
      <MobileProductCardContextMenu
        actions={renderActions()}
        item={entry?.item ?? null}
        label={t("capsule.openProductMenu")}
        open={Boolean(menu.anchor) && isMobileContextMenu}
        originRect={menu.originRect}
        onClose={onClose}
      />
    </>
  );
}
