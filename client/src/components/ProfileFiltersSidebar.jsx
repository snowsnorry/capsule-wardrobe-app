import { Button, Chip, Divider, Stack, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";

function ProfileFiltersSidebar({
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  selectedStyles,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  status,
  onToggleStyle,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onApply,
  onReset,
  onSignOut,
  isSigningOut,
  resetLabelKey = "filters.reset"
}) {
  const { t } = useI18n();
  const isApplyDisabled =
    status.loading ||
    selectedStyles.length === 0 ||
    selectedOccasions.length === 0 ||
    selectedSeasons.length === 0 ||
    !selectedAudience;

  return (
    <Stack
      spacing={3.5}
      sx={{
        height: "100%",
        minHeight: 0
      }}
    >
      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.stylesTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
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

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.occasionsTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
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

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.seasonsTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.seasonsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {seasonOptions.map((item) => (
            <Chip
              key={item}
              label={t(`options.seasons.${item}`)}
              clickable
              color={selectedSeasons.includes(item) ? "primary" : "default"}
              onClick={() => onToggleSeason(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.audienceTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.audienceHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {audienceOptions.map((item) => (
            <Chip
              key={item}
              label={t(`options.audience.${item}`)}
              clickable
              color={selectedAudience === item ? "primary" : "default"}
              onClick={() => onSelectAudience(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={onApply} disabled={isApplyDisabled}>
            {t("filters.apply")}
          </Button>
          <Button variant="outlined" color="inherit" onClick={onReset} disabled={status.loading}>
            {t(resetLabelKey)}
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
      </Stack>

      <Stack sx={{ mt: "auto" }} spacing={2}>
        <Divider />
        <Button
          variant="outlined"
          color="error"
          onClick={onSignOut}
          disabled={isSigningOut}
          sx={{ alignSelf: "flex-start", borderRadius: "999px", px: 2.5 }}
        >
          {t("actions.signOut")}
        </Button>
      </Stack>
    </Stack>
  );
}

export default ProfileFiltersSidebar;
