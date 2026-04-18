import { Button, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import AccentColorChips from "./AccentColorChips";
import StylePreferenceSelector from "./StylePreferenceSelector";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";
import { buildCanonicalPatternOptions } from "../../../shared/patternOptions.js";

function sortPatternOptions(patternOptions, locale) {
  return buildCanonicalPatternOptions(patternOptions).sort((left, right) => {
    if (left === "solid") {
      return -1;
    }
    if (right === "solid") {
      return 1;
    }

    return translateOption("patterns", left, locale).localeCompare(
      translateOption("patterns", right, locale),
      locale
    );
  });
}

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
  selectedText,
  hasFilterChanges = true,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onSelectAccentColor,
  onSelectPattern,
  onTextChange,
  onApply,
  onReset,
  onSignOut,
  isSigningOut,
  isInteractionDisabled = false,
  resetLabelKey = "filters.reset"
}) {
  const { t, locale } = useI18n();
  const missingRequiredFilters = [];

  if (!selectedStyleCore) {
    missingRequiredFilters.push(t("filters.required.styleCore"));
  }
  if (selectedOccasions.length === 0) {
    missingRequiredFilters.push(t("filters.required.occasions"));
  }
  if (selectedSeasons.length === 0) {
    missingRequiredFilters.push(t("filters.required.seasons"));
  }
  if (!selectedAudience) {
    missingRequiredFilters.push(t("filters.required.audience"));
  }

  const isMissingRequiredFilters = missingRequiredFilters.length > 0;
  const showUnchangedFiltersHint = !status.loading && !isMissingRequiredFilters && !hasFilterChanges;
  const isApplyDisabled = status.loading || isInteractionDisabled || isMissingRequiredFilters || !hasFilterChanges;
  const normalizedSelectedPattern = selectedPattern ?? "solid";
  const sortedPatternOptions = sortPatternOptions(patternOptions, locale);

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
        disabled={isInteractionDisabled}
        titleVariant="h6"
        bodyVariant="body2"
      />

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.occasionsTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.occasionsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {occasionOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("occasions", item, locale)}
              clickable
              disabled={isInteractionDisabled}
              color={selectedOccasions.includes(item) ? "primary" : "default"}
              onClick={() => onToggleOccasion(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.seasonsTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.seasonsHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {seasonOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("seasons", item, locale)}
              clickable
              disabled={isInteractionDisabled}
              color={selectedSeasons.includes(item) ? "primary" : "default"}
              onClick={() => onToggleSeason(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.audienceTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.audienceHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {audienceOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("audience", item, locale)}
              clickable
              disabled={isInteractionDisabled}
              color={selectedAudience === item ? "primary" : "default"}
              onClick={() => onSelectAudience(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.accentColorTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.accentColorHint")}
        </Typography>
        <AccentColorChips
          options={accentColorOptions}
          selectedValue={selectedAccentColor}
          onSelect={onSelectAccentColor}
          disabled={isInteractionDisabled}
        />
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.patternTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.patternHint")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {sortedPatternOptions.map((item) => (
            <Chip
              key={item}
              label={translateOption("patterns", item, locale)}
              clickable
              disabled={isInteractionDisabled}
              color={normalizedSelectedPattern === item ? "primary" : "default"}
              onClick={() => onSelectPattern(item)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant="h6">{t("profile.additionalInfoTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.additionalInfoHint")}
        </Typography>
        <TextField
          multiline
          minRows={1}
          maxRows={4}
          disabled={isInteractionDisabled}
          value={selectedText}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder={t("profile.additionalInfoPlaceholder")}
          fullWidth
          InputProps={{
            sx: {
              alignItems: "flex-start",
              "& .MuiInputBase-inputMultiline": {
                overflowY: "auto !important"
              }
            }
          }}
        />
      </Stack>

      <Stack spacing={1.5}>
        {isMissingRequiredFilters ? (
          <Typography variant="body2" color="text.secondary">
            {t("filters.applyDisabledHint", { items: missingRequiredFilters.join(", ") })}
          </Typography>
        ) : null}
        {showUnchangedFiltersHint ? (
          <Typography variant="body2" color="text.secondary">
            {t("filters.applyDisabledUnchangedHint")}
          </Typography>
        ) : null}
        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={onApply} disabled={isApplyDisabled}>
            {t("filters.apply")}
          </Button>
          <Button variant="outlined" color="inherit" onClick={onReset} disabled={status.loading || isInteractionDisabled}>
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

      {typeof onSignOut === "function" ? (
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
      ) : null}
    </Stack>
  );
}

export default ProfileFiltersSidebar;
