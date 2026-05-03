import { Button, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import type { ReactElement } from "react";
import AccentColorChips from "./AccentColorChips";
import StylePreferenceSelector from "./StylePreferenceSelector";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { buildCanonicalPatternOptions } from "../../../shared/patternOptions.js";

type StyleOptions = Parameters<typeof StylePreferenceSelector>[0]["styleOptions"];
type AccentColorOptions = Parameters<typeof AccentColorChips>[0]["options"];
type AccentColorValue = Parameters<NonNullable<Parameters<typeof AccentColorChips>[0]["onSelect"]>>[0];
type ProfileFilterValue = string;

type ProfileFiltersStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type ProfileFiltersSidebarProps = {
  styleOptions: StyleOptions;
  occasionOptions: ProfileFilterValue[];
  seasonOptions: ProfileFilterValue[];
  audienceOptions: ProfileFilterValue[];
  accentColorOptions: AccentColorOptions;
  patternOptions: ProfileFilterValue[];
  selectedStyleCore: ProfileFilterValue | null;
  selectedStyleAesthetic: ProfileFilterValue | null;
  selectedOccasions: ProfileFilterValue[];
  selectedSeasons: ProfileFilterValue[];
  selectedAudience: ProfileFilterValue | null;
  selectedAccentColor: AccentColorValue;
  selectedPattern: ProfileFilterValue | null;
  selectedText: string;
  hasFilterChanges?: boolean;
  status: ProfileFiltersStatus;
  onSelectStyleCore: (value: ProfileFilterValue) => void;
  onSelectStyleAesthetic: (value: ProfileFilterValue | null) => void;
  onToggleOccasion: (value: ProfileFilterValue) => void;
  onToggleSeason: (value: ProfileFilterValue) => void;
  onSelectAudience: (value: ProfileFilterValue) => void;
  onSelectAccentColor: (value: AccentColorValue) => void;
  onSelectPattern: (value: ProfileFilterValue) => void;
  onTextChange: (value: string) => void;
  onApply: () => void;
  onReset: () => void;
  onSignOut?: () => void;
  isSigningOut?: boolean;
  isInteractionDisabled?: boolean;
  resetLabelKey?: string;
};

function sortPatternOptions(patternOptions: ProfileFilterValue[], locale: string): ProfileFilterValue[] {
  return buildCanonicalPatternOptions(patternOptions).map((item) => String(item)).sort((left, right) => {
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

function FilterSectionTitle({ title, hint }: { title: string; hint?: string }): ReactElement {
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      {hint ? (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      ) : null}
    </Stack>
  );
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
}: ProfileFiltersSidebarProps): ReactElement {
  const { t, locale } = useI18n();
  const missingRequiredFilters: string[] = [];

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
        boxSizing: "border-box"
      }}
    >
      <StylePreferenceSelector
        styleOptions={styleOptions}
        selectedStyleCore={selectedStyleCore}
        selectedStyleAesthetic={selectedStyleAesthetic}
        onSelectStyleCore={onSelectStyleCore}
        onSelectStyleAesthetic={onSelectStyleAesthetic}
        disabled={isInteractionDisabled}
        showSectionHeading={false}
        bodyVariant="body2"
      />

      <Stack spacing={1.5}>
        <FilterSectionTitle title={t("profile.occasionsTitle")} hint={t("profile.occasionsHint")} />
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
        <FilterSectionTitle title={t("profile.seasonsTitle")} hint={t("profile.seasonsHint")} />
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
        <FilterSectionTitle title={t("profile.audienceTitle")} hint={t("profile.audienceHint")} />
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
        <FilterSectionTitle title={t("profile.accentColorTitle")} hint={t("profile.accentColorHint")} />
        <AccentColorChips
          options={accentColorOptions}
          selectedValue={selectedAccentColor}
          onSelect={onSelectAccentColor}
          disabled={isInteractionDisabled}
        />
      </Stack>

      <Stack spacing={1.5}>
        <FilterSectionTitle title={t("profile.patternTitle")} hint={t("profile.patternHint")} />
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
        <FilterSectionTitle title={t("profile.additionalInfoTitle")} hint={t("profile.additionalInfoHint")} />
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
              fontSize: "0.875rem",
              "& .MuiInputBase-inputMultiline": {
                overflowY: "auto !important",
                fontSize: "0.875rem",
                lineHeight: 1.5
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

export type { ProfileFiltersSidebarProps, ProfileFiltersStatus };
export default ProfileFiltersSidebar;
