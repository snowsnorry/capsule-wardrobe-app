import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ProfileFiltersSidebar from "../../components/ProfileFiltersSidebar";
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
    >
      <DialogTitle sx={isOverlay ? mobileFiltersDialogTitleSx : undefined}>
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
      <DialogContent>
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
        />
      </DialogContent>
    </Dialog>
  );
}

const mobileFiltersDialogTitleSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
} as const;

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
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
        {src ? (
          <Box
            component="img"
            src={src}
            alt={`Outfit set ${label || ""}`}
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
