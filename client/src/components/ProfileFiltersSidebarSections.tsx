/* eslint-disable max-lines */
import {
  Alert,
  Button,
  Chip,
  Divider,
  FormControl,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { useId } from "react";
import AccentColorChips from "./AccentColorChips";
import { FilterSectionTitle } from "./ProfileFilterSectionTitle";
import { ProfileSignOutAction } from "./ProfileFiltersSidebarActions";
import ProfileFiltersAnchorSection from "./ProfileFiltersAnchorSection";
import StylePreferenceSelector from "./StylePreferenceSelector";
import { translateOption } from "../i18n";
import type {
  CapsuleSourceMode,
  ProfileFiltersSidebarProps,
  ProfileFilterValue,
} from "./ProfileFiltersSidebarTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function ProfileFilterChipSection({
  title,
  hint,
  options,
  selectedValues,
  selectedValue,
  optionGroup,
  locale,
  disabled,
  onSelect,
}: {
  title: string;
  hint: string;
  options: ProfileFilterValue[];
  selectedValues?: ProfileFilterValue[];
  selectedValue?: ProfileFilterValue | null;
  optionGroup: "occasions" | "seasons" | "audience" | "patterns";
  locale: string;
  disabled: boolean;
  onSelect: (value: ProfileFilterValue) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <FilterSectionTitle title={title} hint={hint} />
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {options.map((item) => (
          <Chip
            key={item}
            label={translateOption(optionGroup, item, locale)}
            clickable
            disabled={disabled}
            color={
              selectedValues?.includes(item) || selectedValue === item
                ? "primary"
                : "default"
            }
            onClick={() => onSelect(item)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function ProfileFiltersHeader({
  disabled,
  props,
  showTitle,
  t,
  locale,
}: {
  disabled: boolean;
  props: ProfileFiltersSidebarProps;
  showTitle: boolean;
  t: Translate;
  locale: string;
}) {
  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        {showTitle ? (
          <Typography variant="h6" sx={{ color: "text.primary" }}>
            {t("capsule.settingsTitle")}
          </Typography>
        ) : null}
        <Typography variant="body2" color="text.secondary">
          {t("capsule.settingsSubtitle")}
        </Typography>
        <SourceModeSelect disabled={disabled} props={props} t={t} />
      </Stack>
      <Divider />
      <ProfileFiltersAnchorSection
        anchorPickerFullScreen={props.anchorPickerFullScreen}
        disabled={disabled}
        selectedIds={props.selectedAnchorWardrobeItemIds || []}
        onChange={props.onSelectAnchorWardrobeItemIds}
        t={t}
        locale={locale}
      />
      <Divider />
    </Stack>
  );
}

function SourceModeSelect({
  disabled,
  props,
  t,
}: {
  disabled: boolean;
  props: ProfileFiltersSidebarProps;
  t: Translate;
}) {
  const id = useId();
  const labelId = `${id}-capsule-source-mode-label`;
  const selectId = `${id}-capsule-source-mode`;

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <SourceModeSelectControl
        disabled={disabled}
        labelId={labelId}
        selectId={selectId}
        selectedSourceMode={props.selectedSourceMode}
        onSelectSourceMode={props.onSelectSourceMode}
        t={t}
      />
      <SourceModeStatusAlert status={props.sourceModeStatus} />
    </Stack>
  );
}

function SourceModeSelectControl({
  disabled,
  labelId,
  onSelectSourceMode,
  selectId,
  selectedSourceMode,
  t,
}: {
  disabled: boolean;
  labelId: string;
  onSelectSourceMode: (value: CapsuleSourceMode) => void;
  selectId: string;
  selectedSourceMode: CapsuleSourceMode;
  t: Translate;
}) {
  const handleChange = (event: SelectChangeEvent) => {
    const value = event.target.value;
    if (isSourceMode(value)) {
      onSelectSourceMode(value);
    }
  };

  return (
    <FormControl fullWidth disabled={disabled} size="small">
      <Typography
        id={labelId}
        variant="caption"
        sx={{
          ...sourceModeControlLabelSx,
          color: disabled ? "text.disabled" : "text.secondary",
        }}
      >
        {t("capsule.sourceMode.label")}
      </Typography>
      <Select
        id={selectId}
        labelId={labelId}
        value={selectedSourceMode}
        onChange={handleChange}
        renderValue={(value) => <SourceModeSelectedLabel value={value} t={t} />}
        MenuProps={{ PaperProps: { sx: { maxWidth: 300 } } }}
        sx={sourceModeSelectSx}
      >
        {sourceModeOptions.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            sx={sourceModeItemSx}
          >
            {t(option.labelKey)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

function SourceModeSelectedLabel({
  value,
  t,
}: {
  value: string;
  t: Translate;
}) {
  return (
    <Typography component="span" variant="body2" sx={sourceModeSelectedLabelSx}>
      {getSourceModeLabel(value, t)}
    </Typography>
  );
}

function SourceModeStatusAlert({
  status,
}: {
  status: ProfileFiltersSidebarProps["sourceModeStatus"];
}) {
  if (!status) {
    return null;
  }

  return (
    <Alert severity={status.severity} variant="outlined" sx={sourceModeAlertSx}>
      {status.message}
    </Alert>
  );
}

const sourceModeOptions = [
  {
    labelKey: "capsule.sourceMode.catalogOnly",
    value: "catalog_only",
  },
  {
    labelKey: "capsule.sourceMode.wardrobePreferred",
    value: "wardrobe_preferred",
  },
  {
    labelKey: "capsule.sourceMode.wardrobeOnly",
    value: "wardrobe_only",
  },
] as const;

const sourceModeAlertSx = {
  alignItems: "flex-start",
  borderRadius: "var(--cw-radius-card)",
  py: 0.5,
  "& .MuiAlert-message": {
    fontSize: "0.8125rem",
    lineHeight: 1.35,
  },
} as const;

const sourceModeItemSx = {
  minHeight: "auto",
  py: 1,
  whiteSpace: "normal",
  wordBreak: "break-word",
} as const;

const sourceModeControlLabelSx = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  lineHeight: 1.25,
  mb: 0.75,
  px: 0.25,
} as const;

const sourceModeSelectedLabelSx = {
  fontWeight: 600,
  lineHeight: 1.3,
  whiteSpace: "normal",
  wordBreak: "break-word",
} as const;

const sourceModeSelectSx = {
  bgcolor: "action.hover",
  borderRadius: "var(--cw-radius-card)",
  "&& .MuiSelect-select": {
    alignItems: "center",
    color: "text.primary",
    display: "flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    lineHeight: 1.3,
    minHeight: "unset",
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
} as const;

function isSourceMode(value: string): value is CapsuleSourceMode {
  return sourceModeOptions.some((option) => option.value === value);
}

function getSourceModeLabel(value: string, t: Translate) {
  const option = sourceModeOptions.find((item) => item.value === value);
  return t(option?.labelKey || "capsule.sourceMode.catalogOnly");
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

function ProfileFilterActions({
  missingRequiredFilters,
  showUnchangedFiltersHint,
  isApplyDisabled,
  props,
  t,
}: {
  missingRequiredFilters: string[];
  showUnchangedFiltersHint: boolean;
  isApplyDisabled: boolean;
  props: ProfileFiltersSidebarProps;
  t: Translate;
}) {
  return (
    <Stack spacing={1.5} sx={{ width: "100%", alignItems: "flex-end" }}>
      {missingRequiredFilters.length > 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t("filters.applyDisabledHint", {
            items: missingRequiredFilters.join(", "),
          })}
        </Typography>
      ) : null}
      {showUnchangedFiltersHint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t("filters.applyDisabledUnchangedHint")}
        </Typography>
      ) : null}
      <Stack direction="row" spacing={2}>
        <Button
          variant="outlined"
          color="inherit"
          onClick={props.onReset}
          disabled={
            props.status.loading || Boolean(props.isInteractionDisabled)
          }
        >
          {t(props.resetLabelKey ?? "filters.reset")}
        </Button>
        <Button
          variant="contained"
          onClick={props.onApply}
          disabled={isApplyDisabled}
        >
          {t("filters.apply")}
        </Button>
      </Stack>
      {props.status.error ? (
        <Typography variant="body2" color="error" sx={{ alignSelf: "stretch" }}>
          {props.status.error}
        </Typography>
      ) : null}
      {props.status.infoKey && props.status.infoKey !== "auth.signedIn" ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ alignSelf: "stretch" }}
        >
          {t(props.status.infoKey, props.status.infoParams || undefined)}
        </Typography>
      ) : null}
    </Stack>
  );
}

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

function ProfileFiltersSidebarFrame({
  props,
  sortedPatternOptions,
  normalizedSelectedPattern,
  missingRequiredFilters,
  showUnchangedFiltersHint,
  isApplyDisabled,
  t,
  locale,
}: {
  props: ProfileFiltersSidebarProps;
  sortedPatternOptions: ProfileFilterValue[];
  normalizedSelectedPattern: ProfileFilterValue;
  missingRequiredFilters: string[];
  showUnchangedFiltersHint: boolean;
  isApplyDisabled: boolean;
  t: Translate;
  locale: string;
}) {
  const disabled = Boolean(props.isInteractionDisabled);

  return (
    <Stack spacing={3.5} sx={{ boxSizing: "border-box" }}>
      <ProfileFiltersHeader
        disabled={disabled}
        props={props}
        showTitle={props.showSettingsTitle !== false}
        t={t}
        locale={locale}
      />
      <ProfileFilterControls
        disabled={disabled}
        locale={locale}
        normalizedSelectedPattern={normalizedSelectedPattern}
        props={props}
        sortedPatternOptions={sortedPatternOptions}
        t={t}
      />
      <ProfileTextSection
        selectedText={props.selectedText}
        disabled={disabled}
        onTextChange={props.onTextChange}
        t={t}
      />
      {props.showFooterActions === false ? null : (
        <ProfileFilterActions
          missingRequiredFilters={missingRequiredFilters}
          showUnchangedFiltersHint={showUnchangedFiltersHint}
          isApplyDisabled={isApplyDisabled}
          props={props}
          t={t}
        />
      )}
      <ProfileSignOutAction
        onSignOut={props.onSignOut}
        isSigningOut={props.isSigningOut}
        t={t}
      />
    </Stack>
  );
}

export { ProfileFilterActions, ProfileFiltersSidebarFrame };
