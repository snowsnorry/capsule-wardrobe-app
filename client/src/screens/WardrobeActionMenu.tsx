import { ListItemIcon, Menu, MenuItem } from "@mui/material";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import { useI18n } from "../i18n/useI18n";
import CardLayoutMenuSection from "./mainScreen/CapsuleActionMenuLayout";
import type { MobileCardColumns } from "./mainScreen/MainScreenTypes";

type WardrobeActionMenuProps = {
  anchorEl: HTMLElement | null;
  disabled: boolean;
  isOverlay: boolean;
  mobileCardColumns: MobileCardColumns;
  onClose: () => void;
  onDownloadPdf: () => void;
  onMobileCardColumnsChange: (value: MobileCardColumns) => void;
};

function WardrobeActionMenu({
  anchorEl,
  disabled,
  isOverlay,
  mobileCardColumns,
  onClose,
  onDownloadPdf,
  onMobileCardColumnsChange,
}: WardrobeActionMenuProps) {
  const { t } = useI18n();
  const handleDownloadPdf = () => {
    onClose();
    onDownloadPdf();
  };

  return (
    <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={onClose}>
      <MenuItem disabled={disabled} onClick={handleDownloadPdf}>
        <ListItemIcon>
          <DownloadRoundedIcon fontSize="small" />
        </ListItemIcon>
        {t("capsule.exportPdf")}
      </MenuItem>
      <CardLayoutMenuSection
        show={isOverlay}
        disabled={disabled}
        mobileCardColumns={mobileCardColumns}
        onClose={onClose}
        onMobileCardColumnsChange={onMobileCardColumnsChange}
      />
    </Menu>
  );
}

export default WardrobeActionMenu;
