import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
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
import { getOutfitItem } from "./outfitItemMappers";

type OutfitMenuProps = {
  anchor: HTMLElement | null;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  outfit: OutfitMeta | null;
  onClose: () => void;
  onAnalyze: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onDuplicate: () => void;
  onMobileCardColumnsChange: (value: MobileCardColumns) => void;
  onRevert: () => void;
  onSave: () => void;
  showCardLayout: boolean;
  showAnalyze: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function AnalyzeMenuSection({
  disabled,
  outfit,
  onAnalyze,
  showAnalyze,
  t,
}: Pick<
  OutfitMenuProps,
  "disabled" | "outfit" | "onAnalyze" | "showAnalyze" | "t"
>) {
  if (!showAnalyze) return null;

  return (
    <>
      <MenuItem disabled={disabled || !outfit?.id} onClick={onAnalyze}>
        <ListItemIcon>
          <AutoAwesomeRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("outfit.analyzeOutfit")}</ListItemText>
      </MenuItem>
      <Divider />
    </>
  );
}

function OutfitLifecycleMenuSection({
  disabled,
  outfit,
  onDelete,
  onDuplicate,
  onRevert,
  onSave,
  t,
}: Pick<
  OutfitMenuProps,
  | "disabled"
  | "outfit"
  | "onDelete"
  | "onDuplicate"
  | "onRevert"
  | "onSave"
  | "t"
>) {
  const hasOutfitId = Boolean(outfit?.id);
  const isSaved = outfit?.status === "saved";

  return (
    <>
      <Divider />
      <MenuItem disabled={disabled || isSaved} onClick={onRevert}>
        <ListItemIcon>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.revert")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled || isSaved} onClick={onSave}>
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("actions.save")}</ListItemText>
      </MenuItem>
      <MenuItem disabled={disabled || !hasOutfitId} onClick={onDuplicate}>
        <ListItemIcon sx={{ visibility: "hidden" }}>
          <RestoreRoundedIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>{t("capsule.saveAs")}</ListItemText>
      </MenuItem>
      <Divider />
      <MenuItem
        disabled={disabled || !hasOutfitId}
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
    </>
  );
}

export function OutfitMenu({
  anchor,
  disabled,
  mobileCardColumns,
  outfit,
  onClose,
  onAnalyze,
  onDelete,
  onDownload,
  onDuplicate,
  onMobileCardColumnsChange,
  onRevert,
  onSave,
  showCardLayout,
  showAnalyze,
  t,
}: OutfitMenuProps) {
  return (
    <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={onClose}>
      <AnalyzeMenuSection
        disabled={disabled}
        outfit={outfit}
        showAnalyze={showAnalyze}
        t={t}
        onAnalyze={onAnalyze}
      />
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
      <OutfitLifecycleMenuSection
        disabled={disabled}
        outfit={outfit}
        t={t}
        onDelete={onDelete}
        onDuplicate={onDuplicate}
        onRevert={onRevert}
        onSave={onSave}
      />
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
  const item = getOutfitItem(entry);
  const liked = isLikedItem(item);
  const showLikeAction = Boolean(item && getCanonicalItemUrl(item));
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
      {showLikeAction ? (
        <MenuItem
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
      ) : null}
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
        item={item}
        label={t(
          item ? "capsule.openProductMenu" : "outfit.openMissingItemActions",
        )}
        open={Boolean(menu.anchor) && isMobileContextMenu}
        originRect={menu.originRect}
        onClose={onClose}
      />
    </>
  );
}
