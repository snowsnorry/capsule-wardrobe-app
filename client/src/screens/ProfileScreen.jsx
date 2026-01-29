import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import { useI18n } from "../i18n/useI18n.js";

function ProfileScreen({
  styleOptions,
  occasionOptions,
  selectedStyles,
  selectedOccasions,
  status,
  onToggleStyle,
  onToggleOccasion,
  onSave,
  onDelete,
  onBack
}) {
  const { t } = useI18n();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const handleOpenDelete = () => {
    setIsDeleteOpen(true);
  };

  const handleCloseDelete = () => {
    setIsDeleteOpen(false);
  };

  const handleConfirmDelete = () => {
    setIsDeleteOpen(false);
    onDelete();
  };

  return (
    <Stack spacing={3}>
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 1,
          backgroundColor: "background.paper",
          pb: 1
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4">{t("profile.title")}</Typography>
          <LocaleSwitcher />
        </Stack>
      </Box>

      <Divider />

      <Typography variant="body2" color="text.secondary">
        {t("profile.subtitle")}
      </Typography>

      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.stylesTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.stylesHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {styleOptions.map((style) => (
            <Chip
              key={style}
              label={t(`options.styles.${style}`)}
              clickable
              color={selectedStyles.includes(style) ? "primary" : "default"}
              onClick={() => onToggleStyle(style)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.occasionsTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.occasionsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {occasionOptions.map((item) => (
            <Chip
              key={item}
              label={t(`options.occasions.${item}`)}
              clickable
              color={selectedOccasions.includes(item) ? "primary" : "default"}
              onClick={() => onToggleOccasion(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" onClick={onBack}>
          {t("profile.back")}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={
            status.loading || selectedStyles.length === 0 || selectedOccasions.length === 0
          }
        >
          {t("profile.save")}
        </Button>
        <Button variant="text" color="error" onClick={handleOpenDelete} disabled={status.loading}>
          {t("profile.delete")}
        </Button>
      </Stack>

      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
      {status.info && status.info !== t("auth.signedIn") ? (
        <Typography variant="body2" color="text.secondary">
          {status.info}
        </Typography>
      ) : null}
      <Dialog open={isDeleteOpen} onClose={handleCloseDelete}>
        <DialogTitle>{t("profile.deleteConfirmTitle")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("profile.deleteConfirmBody")}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDelete} disabled={status.loading}>
            {t("profile.deleteConfirmCancel")}
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            variant="contained"
            disabled={status.loading}
          >
            {t("profile.deleteConfirmConfirm")}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ProfileScreen;
