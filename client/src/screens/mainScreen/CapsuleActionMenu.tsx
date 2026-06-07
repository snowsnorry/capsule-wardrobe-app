import type { MouseEvent, ReactNode } from "react";
import {
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  type SxProps,
  type Theme,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { useI18n } from "../../i18n/useI18n";
import { getCapsuleMenuPermissions } from "./CapsuleActionMenuPermissions";
import CardLayoutMenuSection from "./CapsuleActionMenuLayout";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MobileCardColumns,
} from "./MainScreenTypes";

type CapsuleActionMenuProps = {
  anchorEl: CapsuleMenuAnchor;
  open: boolean;
  onClose: () => void;
  capsule?: CapsuleLike | null;
  disabled?: boolean;
  showRegenerateAll?: boolean;
  onRegenerateAll?: () => void;
  onDownloadPdf: () => void;
  onRename: () => void;
  onRevert: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onShare: () => void;
  showShare?: boolean;
  allowUnknownShareContent?: boolean;
  showCardLayout?: boolean;
  mobileCardColumns?: MobileCardColumns;
  onMobileCardColumnsChange?: (value: MobileCardColumns) => void;
  onDelete: () => void;
};

type ActionMenuItemProps = {
  disabled?: boolean;
  icon?: ReactNode;
  reserveIconSpace?: boolean;
  onAction: () => void;
  onClose: () => void;
  sx?: SxProps<Theme>;
  children: ReactNode;
};

function ActionMenuItem({
  disabled = false,
  icon = null,
  reserveIconSpace = false,
  onAction,
  onClose,
  sx,
  children,
}: ActionMenuItemProps) {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.blur();
    onClose();
    onAction();
  };

  return (
    <MenuItem disabled={disabled} onClick={handleClick} sx={sx}>
      <ListItemIcon
        sx={reserveIconSpace ? { visibility: "hidden" } : undefined}
      >
        {icon}
      </ListItemIcon>
      {children}
    </MenuItem>
  );
}

function ShareMenuItem({
  show,
  disabled,
  onClose,
  onShare,
}: {
  show: boolean;
  disabled: boolean;
  onClose: () => void;
  onShare: () => void;
}) {
  const { t } = useI18n();
  if (!show) {
    return null;
  }

  return (
    <ActionMenuItem
      disabled={disabled}
      icon={<ShareRoundedIcon fontSize="small" />}
      onAction={onShare}
      onClose={onClose}
    >
      {t("capsule.share")}
    </ActionMenuItem>
  );
}

function RegenerateAllMenuSection({
  show,
  disabled,
  onClose,
  onRegenerateAll,
}: {
  show: boolean;
  disabled: boolean;
  onClose: () => void;
  onRegenerateAll?: () => void;
}) {
  const { t } = useI18n();
  if (!show) {
    return null;
  }

  return (
    <>
      <ActionMenuItem
        disabled={disabled}
        reserveIconSpace
        onAction={() => onRegenerateAll?.()}
        onClose={onClose}
      >
        {t("capsule.regenerateAll")}
      </ActionMenuItem>
      <Divider />
    </>
  );
}

function CapsuleEditMenuSection({
  disabled,
  canRevert,
  canSave,
  canDuplicate,
  onClose,
  onRename,
  onRevert,
  onSave,
  onDuplicate,
  onDelete,
}: {
  disabled: boolean;
  canRevert: boolean;
  canSave: boolean;
  canDuplicate: boolean;
  onClose: () => void;
  onRename: () => void;
  onRevert: () => void;
  onSave: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <Divider />
      <ActionMenuItem
        disabled={disabled}
        icon={<DriveFileRenameOutlineRoundedIcon fontSize="small" />}
        onAction={onRename}
        onClose={onClose}
      >
        {t("capsule.rename")}
      </ActionMenuItem>
      <Divider />
      <ActionMenuItem
        disabled={disabled || !canRevert}
        icon={<RestoreRoundedIcon fontSize="small" />}
        onAction={onRevert}
        onClose={onClose}
      >
        {t("capsule.revert")}
      </ActionMenuItem>
      <ActionMenuItem
        disabled={disabled || !canSave}
        reserveIconSpace
        onAction={onSave}
        onClose={onClose}
      >
        {t("actions.save")}
      </ActionMenuItem>
      {canDuplicate ? (
        <ActionMenuItem
          disabled={disabled}
          reserveIconSpace
          onAction={onDuplicate}
          onClose={onClose}
        >
          {t("capsule.saveAs")}
        </ActionMenuItem>
      ) : null}
      <Divider />
      <ActionMenuItem
        disabled={disabled}
        icon={<DeleteOutlineRoundedIcon fontSize="small" />}
        onAction={onDelete}
        onClose={onClose}
        sx={{
          color: "error.main",
          "& .MuiListItemIcon-root": { color: "inherit" },
        }}
      >
        {t("actions.delete")}
      </ActionMenuItem>
    </>
  );
}

function CapsuleActionMenu({
  anchorEl,
  open,
  onClose,
  capsule,
  disabled = false,
  showRegenerateAll = false,
  onRegenerateAll,
  onDownloadPdf,
  onRename,
  onRevert,
  onSave,
  onDuplicate,
  onShare,
  showShare = true,
  allowUnknownShareContent = false,
  showCardLayout = false,
  mobileCardColumns = 2,
  onMobileCardColumnsChange = undefined,
  onDelete,
}: CapsuleActionMenuProps) {
  const { t } = useI18n();
  const permissions = getCapsuleMenuPermissions(
    capsule,
    allowUnknownShareContent,
  );

  return (
    <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
      <RegenerateAllMenuSection
        show={showRegenerateAll}
        disabled={disabled}
        onClose={onClose}
        onRegenerateAll={onRegenerateAll}
      />
      <ActionMenuItem
        disabled={disabled}
        icon={<DownloadRoundedIcon fontSize="small" />}
        onAction={onDownloadPdf}
        onClose={onClose}
      >
        {t("capsule.exportPdf")}
      </ActionMenuItem>
      <ShareMenuItem
        show={showShare && permissions.canShare}
        disabled={disabled}
        onClose={onClose}
        onShare={onShare}
      />
      <CardLayoutMenuSection
        show={showCardLayout}
        disabled={disabled}
        mobileCardColumns={mobileCardColumns}
        onClose={onClose}
        onMobileCardColumnsChange={onMobileCardColumnsChange}
      />
      <CapsuleEditMenuSection
        disabled={disabled}
        canRevert={permissions.canRevert}
        canSave={permissions.canSave}
        canDuplicate={permissions.canDuplicate}
        onClose={onClose}
        onRename={onRename}
        onRevert={onRevert}
        onSave={onSave}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </Menu>
  );
}

export default CapsuleActionMenu;
