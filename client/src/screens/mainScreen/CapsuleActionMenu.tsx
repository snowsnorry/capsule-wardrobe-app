import type { MouseEvent, ReactNode } from "react";
import {
  Box,
  Divider,
  ListItemIcon,
  Menu,
  MenuItem,
  type SxProps,
  ToggleButton,
  ToggleButtonGroup,
  type Theme,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { useI18n } from "../../i18n/useI18n";
import { isMobileCardColumns } from "./MainScreenHelpers";
import { getCapsuleMenuPermissions } from "./CapsuleActionMenuPermissions";
import ColumnLayoutIcon from "./ColumnLayoutIcon";
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

function CardLayoutMenuSection({
  show,
  disabled,
  mobileCardColumns,
  onClose,
  onMobileCardColumnsChange,
}: {
  show: boolean;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  onClose: () => void;
  onMobileCardColumnsChange?: (value: MobileCardColumns) => void;
}) {
  const { t } = useI18n();
  if (!show) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box
        sx={{
          px: 2,
          py: 1.25,
          display: "grid",
          gap: 1,
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase" }}
        >
          {t("capsule.cardLayout")}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mobileCardColumns}
          onChange={(_event, value) => {
            if (isMobileCardColumns(value)) {
              onClose();
              onMobileCardColumnsChange?.(value);
            }
          }}
          aria-label={t("capsule.cardLayout")}
          sx={{
            alignSelf: "start",
            "& .MuiToggleButton-root": {
              minWidth: 44,
              height: 40,
              px: 1.25,
            },
          }}
        >
          <ToggleButton
            value={1}
            aria-label={t("capsule.cardColumnsOne")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={1} />
          </ToggleButton>
          <ToggleButton
            value={2}
            aria-label={t("capsule.cardColumnsTwo")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={2} />
          </ToggleButton>
          <ToggleButton
            value={3}
            aria-label={t("capsule.cardColumnsThree")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={3} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
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
        show={permissions.canShare}
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
