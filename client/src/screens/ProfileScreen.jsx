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
import AccentColorChips from "../components/AccentColorChips.jsx";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

function ProfileScreen({
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  accentColorOptions,
  selectedStyles,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  selectedAccentColor,
  status,
  onToggleStyle,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
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
              label={translateOption("styles", style)}
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
              label={translateOption("occasions", item)}
              clickable
              color={selectedOccasions.includes(item) ? "primary" : "default"}
              onClick={() => onToggleOccasion(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.seasonsTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.seasonsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {seasonOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("seasons", item)}
              clickable
              color={selectedSeasons.includes(item) ? "primary" : "default"}
              onClick={() => onToggleSeason(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.audienceTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.audienceHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {audienceOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("audience", item)}
              clickable
              color={selectedAudience === item ? "primary" : "default"}
              onClick={() => onSelectAudience(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.accentColorTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.accentColorHint")}
        </Typography>
        <AccentColorChips
          options={accentColorOptions}
          selectedValue={selectedAccentColor}
          onSelect={onSelectAccentColor}
        />
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <Button variant="outlined" onClick={onBack}>
          {t("profile.back")}
        </Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={
            status.loading ||
            selectedStyles.length === 0 ||
            selectedOccasions.length === 0 ||
            selectedSeasons.length === 0 ||
            !selectedAudience
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
      {status.infoKey && status.infoKey !== "auth.signedIn" ? (
        <Typography variant="body2" color="text.secondary">
          {t(status.infoKey, status.infoParams || undefined)}
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
