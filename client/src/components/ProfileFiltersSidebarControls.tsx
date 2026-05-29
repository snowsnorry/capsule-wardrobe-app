import { Stack, TextField } from "@mui/material";
import AccentColorChips from "./AccentColorChips";
import { FilterSectionTitle } from "./ProfileFilterSectionTitle";
import { ProfileFilterChipSection } from "./ProfileFilterChipSection";
import StylePreferenceSelector from "./StylePreferenceSelector";
import type {
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
} from "./ProfileFiltersSidebarTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function ProfileFilterControls({
  disabled,
  locale,
  normalizedSelectedPattern,
  props,
  sortedPatternOptions,
  t,
}: {
  disabled: boolean;
  locale: string;
  normalizedSelectedPattern: ProfileFilterValue;
  props: ProfileFiltersSidebarProps;
  sortedPatternOptions: ProfileFilterValue[];
  t: Translate;
}) {
  return (
    <>
      <StylePreferenceSelector
        styleOptions={props.styleOptions}
        selectedStyleCore={props.selectedStyleCore}
        selectedStyleAesthetic={props.selectedStyleAesthetic}
        onSelectStyleCore={props.onSelectStyleCore}
        onSelectStyleAesthetic={props.onSelectStyleAesthetic}
        disabled={disabled}
        showSectionHeading={false}
        bodyVariant="body2"
      />
      <ProfileFilterChipSection
        title={t("profile.occasionsTitle")}
        hint={t("profile.occasionsHint")}
        options={props.occasionOptions}
        selectedValues={props.selectedOccasions}
        optionGroup="occasions"
        locale={locale}
        disabled={disabled}
        onSelect={props.onToggleOccasion}
      />
      <ProfileFilterChipSection
        title={t("profile.seasonsTitle")}
        hint={t("profile.seasonsHint")}
        options={props.seasonOptions}
        selectedValues={props.selectedSeasons}
        optionGroup="seasons"
        locale={locale}
        disabled={disabled}
        onSelect={props.onToggleSeason}
      />
      <ProfileFilterChipSection
        title={t("profile.audienceTitle")}
        hint={t("profile.audienceHint")}
        options={props.audienceOptions}
        selectedValue={props.selectedAudience}
        optionGroup="audience"
        locale={locale}
        disabled={disabled}
        onSelect={props.onSelectAudience}
      />
      <ProfileAccentColorSection disabled={disabled} props={props} t={t} />
      <ProfileFilterChipSection
        title={t("profile.patternTitle")}
        hint={t("profile.patternHint")}
        options={sortedPatternOptions}
        selectedValue={normalizedSelectedPattern}
        optionGroup="patterns"
        locale={locale}
        disabled={disabled}
        onSelect={props.onSelectPattern}
      />
    </>
  );
}

function ProfileAccentColorSection({
  disabled,
  props,
  t,
}: {
  disabled: boolean;
  props: ProfileFiltersSidebarProps;
  t: Translate;
}) {
  return (
    <Stack spacing={1.5}>
      <FilterSectionTitle
        title={t("profile.accentColorTitle")}
        hint={t("profile.accentColorHint")}
      />
      <AccentColorChips
        options={props.accentColorOptions}
        selectedValue={props.selectedAccentColor}
        onSelect={props.onSelectAccentColor}
        disabled={disabled}
      />
    </Stack>
  );
}

function ProfileTextSection({
  selectedText,
  disabled,
  onTextChange,
  t,
}: {
  selectedText: string;
  disabled: boolean;
  onTextChange: (value: string) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={1.5}>
      <FilterSectionTitle
        title={t("profile.additionalInfoTitle")}
        hint={t("profile.additionalInfoHint")}
      />
      <TextField
        multiline
        minRows={1}
        maxRows={4}
        disabled={disabled}
        value={selectedText}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder={t("profile.additionalInfoPlaceholder")}
        fullWidth
        InputProps={{
          sx: {
            alignItems: "flex-start",
            "& .MuiInputBase-inputMultiline": {
              overflowY: "auto !important",
            },
          },
        }}
      />
    </Stack>
  );
}

export { ProfileFilterControls, ProfileTextSection };
