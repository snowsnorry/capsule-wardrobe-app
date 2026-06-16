import { Divider, Menu } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import RestoreRoundedIcon from "@mui/icons-material/RestoreRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import { useI18n } from "../../i18n/useI18n";
import ActionMenuItem from "./CapsuleActionMenuItem";
import { getCapsuleMenuPermissions } from "./CapsuleActionMenuPermissions";
import CapsulePinMenuItem from "./CapsulePinMenuItem";
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
  showAnalyze?: boolean;
  canAnalyze?: boolean;
  onAnalyze?: () => void;
  showRegenerateAll?: boolean;
  onRegenerateAll?: () => void;
  onDownloadPdf: () => void;
  onRename: () => void;
  onRevert: () => void;
  onSave: () => void;
  onSetPin?: (pin: boolean) => void;
  onDuplicate: () => void;
  onShare: () => void;
  showShare?: boolean;
  allowUnknownShareContent?: boolean;
  showCardLayout?: boolean;
  mobileCardColumns?: MobileCardColumns;
  onMobileCardColumnsChange?: (value: MobileCardColumns) => void;
  onDelete: () => void;
  pinCopyPrefix?: "capsule" | "outfit";
};

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

function AnalyzeMenuSection({
  canAnalyze,
  disabled,
  onAnalyze,
  onClose,
  show,
}: {
  canAnalyze: boolean;
  disabled: boolean;
  onAnalyze?: () => void;
  onClose: () => void;
  show: boolean;
}) {
  const { t } = useI18n();
  if (!show) {
    return null;
  }

  return (
    <>
      <ActionMenuItem
        disabled={disabled || !canAnalyze}
        icon={<AutoAwesomeRoundedIcon fontSize="small" />}
        onAction={() => onAnalyze?.()}
        onClose={onClose}
      >
        {t("capsule.analyzeCapsule")}
      </ActionMenuItem>
      <Divider />
    </>
  );
}

function CapsuleEditMenuSection({
  disabled,
  capsule,
  canRevert,
  canSave,
  canDuplicate,
  onClose,
  onRename,
  onRevert,
  onSave,
  onSetPin,
  onDuplicate,
  onDelete,
  pinCopyPrefix = "capsule",
}: {
  disabled: boolean;
  capsule?: CapsuleLike | null;
  canRevert: boolean;
  canSave: boolean;
  canDuplicate: boolean;
  onClose: () => void;
  onRename: () => void;
  onRevert: () => void;
  onSave: () => void;
  onSetPin?: (pin: boolean) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  pinCopyPrefix?: "capsule" | "outfit";
}) {
  const { t } = useI18n();
  const isPinned = Boolean(capsule?.pin);

  return (
    <>
      <Divider />
      <CapsulePinMenuItem
        disabled={disabled || !capsule?.id || !onSetPin}
        isPinned={isPinned}
        onClose={onClose}
        onSetPin={onSetPin}
        pinCopyPrefix={pinCopyPrefix}
      />
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
      <DeleteMenuItem disabled={disabled} onClose={onClose} onDelete={onDelete}>
        {t("actions.delete")}
      </DeleteMenuItem>
    </>
  );
}

function DeleteMenuItem({
  children,
  disabled,
  onClose,
  onDelete,
}: {
  children: string;
  disabled: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  return (
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
      {children}
    </ActionMenuItem>
  );
}

function CapsuleActionMenu({
  anchorEl,
  open,
  onClose,
  capsule,
  disabled = false,
  showAnalyze = false,
  canAnalyze = false,
  onAnalyze,
  showRegenerateAll = false,
  onRegenerateAll,
  onDownloadPdf,
  onRename,
  onRevert,
  onSave,
  onSetPin,
  onDuplicate,
  onShare,
  showShare = true,
  allowUnknownShareContent = false,
  showCardLayout = false,
  mobileCardColumns = 2,
  onMobileCardColumnsChange = undefined,
  onDelete,
  pinCopyPrefix = "capsule",
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
      <AnalyzeMenuSection
        show={showAnalyze}
        disabled={disabled}
        canAnalyze={canAnalyze}
        onClose={onClose}
        onAnalyze={onAnalyze}
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
        capsule={capsule}
        canRevert={permissions.canRevert}
        canSave={permissions.canSave}
        canDuplicate={permissions.canDuplicate}
        onClose={onClose}
        onRename={onRename}
        onRevert={onRevert}
        onSave={onSave}
        onSetPin={onSetPin}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
        pinCopyPrefix={pinCopyPrefix}
      />
    </Menu>
  );
}

export default CapsuleActionMenu;
