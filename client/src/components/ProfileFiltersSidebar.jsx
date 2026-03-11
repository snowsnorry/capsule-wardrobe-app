import { Button, Chip, Divider, Stack, Typography } from "@mui/material";
import AccentColorChips from "./AccentColorChips.jsx";
import StylePreferenceSelector from "./StylePreferenceSelector.jsx";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

function ProfileFiltersSidebar({
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  accentColorOptions,
  patternOptions,
  selectedStyleCore,
  selectedStyleAesthetic,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  selectedAccentColor,
  selectedPattern,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
  onSelectPattern,
  onApply,
  onReset,
  onSignOut,
  isSigningOut,
  resetLabelKey = "filters.reset"
}) {
  const { t, locale } = useI18n();
  const isApplyDisabled =
    status.loading ||
    !selectedStyleCore ||
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
      <StylePreferenceSelector
        styleOptions={styleOptions}
        selectedStyleCore={selectedStyleCore}
        selectedStyleAesthetic={selectedStyleAesthetic}
        onSelectStyleCore={onSelectStyleCore}
        onSelectStyleAesthetic={onSelectStyleAesthetic}
      />

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.occasionsTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.occasionsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {occasionOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("occasions", item, locale)}
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
              label={translateOption("seasons", item, locale)}
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
              label={translateOption("audience", item, locale)}
              clickable
              color={selectedAudience === item ? "primary" : "default"}
              onClick={() => onSelectAudience(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.accentColorTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.accentColorHint")}
        </Typography>
        <AccentColorChips
          options={accentColorOptions}
          selectedValue={selectedAccentColor}
          onSelect={onSelectAccentColor}
        />
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h5">{t("profile.patternTitle")}</Typography>
        <Typography variant="body1" color="text.secondary">
          {t("profile.patternHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            label={t("profile.patternNotImportant")}
            clickable
            color={selectedPattern === null ? "primary" : "default"}
            onClick={() => onSelectPattern(null)}
          />
          {patternOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("patterns", item, locale)}
              clickable
              color={selectedPattern === item ? "primary" : "default"}
              onClick={() => onSelectPattern(item)}
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
