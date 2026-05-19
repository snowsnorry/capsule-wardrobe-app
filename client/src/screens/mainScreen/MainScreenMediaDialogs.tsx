import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import ProfileFiltersSidebar, {
  ProfileFiltersActions,
} from "../../components/ProfileFiltersSidebar";
import { useI18n } from "../../i18n/useI18n";
import type { MainScreenProps } from "./MainScreenTypes";

export function FiltersDialog({
  props,
  disabled,
  open,
  isOverlay,
  setOpen,
}: {
  props: MainScreenProps;
  disabled: boolean;
  open: boolean;
  isOverlay: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={() => !disabled && setOpen(false)}
      fullScreen={isOverlay}
      PaperProps={isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined}
    >
      <DialogTitle sx={isOverlay ? mobileCapsuleDialogTitleSx : undefined}>
        {isOverlay ? (
          <Typography component="span" variant="h6">
            {t("capsule.settingsTitle")}
          </Typography>
        ) : null}
        <IconButton
          aria-label={t("capsule.closeFilters")}
          disabled={disabled}
          onClick={() => setOpen(false)}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={isOverlay ? mobileCapsuleDialogContentSx : undefined}>
        <ProfileFiltersSidebar
          {...props}
          onApply={async () => {
            setOpen(false);
            await props.onApplyFilters();
          }}
          onReset={async () => {
            setOpen(false);
            await props.onResetFilters();
          }}
          onSignOut={null}
          isInteractionDisabled={disabled}
          showSettingsTitle={!isOverlay}
          showFooterActions={false}
        />
      </DialogContent>
      <DialogActions
        sx={
          isOverlay
            ? mobileCapsuleDialogActionsSx
            : { px: 3, pb: 2.5, pt: 2, bgcolor: "background.paper" }
        }
      >
        <ProfileFiltersActions
          {...props}
          onApply={async () => {
            setOpen(false);
            await props.onApplyFilters();
          }}
          onReset={async () => {
            setOpen(false);
            await props.onResetFilters();
          }}
          onSignOut={undefined}
          isInteractionDisabled={disabled}
          showSettingsTitle={!isOverlay}
          showFooterActions={false}
        />
      </DialogActions>
    </Dialog>
  );
}

export function ImageDialog({
  src,
  label,
  disabled,
  open,
  setOpen,
}: {
  src: string;
  label?: number;
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={() => !disabled && setOpen(false)}
      fullScreen
      maxWidth={false}
      PaperProps={{
        "data-testid": "outfit-set-image-dialog-paper",
        sx: { bgcolor: "transparent", boxShadow: "none" },
      }}
    >
      <Box
        data-testid="outfit-set-image-dialog"
        onClick={() => !disabled && setOpen(false)}
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <IconButton
          aria-label={t("actions.close")}
          disabled={disabled}
          onClick={() => setOpen(false)}
          sx={{
            position: "fixed",
            top: 16,
            right: 16,
            bgcolor: "rgba(255,255,255,0.9)",
            color: "common.black",
            "&:hover": {
              bgcolor: "rgba(255,255,255,1)",
            },
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
        {src ? (
          <Box
            component="img"
            src={src}
            alt={`Outfit set ${label || ""}`}
            onClick={(event) => event.stopPropagation()}
            sx={{
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 32px)",
              borderRadius: "8px",
            }}
          />
        ) : null}
      </Box>
    </Dialog>
  );
}
