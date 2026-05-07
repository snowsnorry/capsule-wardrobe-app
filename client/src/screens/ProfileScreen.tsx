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
  Typography,
} from "@mui/material";
import LocaleSwitcher from "../components/LocaleSwitcher";
import AccentColorChips from "../components/AccentColorChips";
import StylePreferenceSelector from "../components/StylePreferenceSelector";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { buildCanonicalPatternOptions } from "../../../shared/patternOptions.js";

type StyleOptions = {
  core: string[];
  aesthetics: string[];
};

type ScreenStatus = {
  loading: boolean;
  error: string;
  infoKey: string;
  infoParams: Record<string, unknown> | null;
};

type ProfileScreenProps = {
  styleOptions: StyleOptions;
  occasionOptions: string[];
  seasonOptions: string[];
  audienceOptions: string[];
  accentColorOptions: string[];
  patternOptions: string[];
  selectedStyleCore: string;
  selectedStyleAesthetic: string | null;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string;
  selectedAccentColor: string | null;
  selectedPattern: string | null;
  selectedText?: string;
  status: ScreenStatus;
  onSelectStyleCore: (value: string) => void;
  onSelectStyleAesthetic: (value: string) => void;
  onToggleOccasion: (value: string) => void;
  onToggleSeason: (value: string) => void;
  onSelectAudience: (value: string) => void;
  onSelectAccentColor: (value: string) => void;
  onSelectPattern: (value: string) => void;
  onTextChange?: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onBack: () => void;
};

function sortPatternOptions(patternOptions: string[], locale: string) {
  return buildCanonicalPatternOptions(patternOptions).sort((left, right) => {
    if (left === "solid") {
      return -1;
    }
    if (right === "solid") {
      return 1;
    }

    return translateOption("patterns", left, locale).localeCompare(
      translateOption("patterns", right, locale),
      locale,
    );
  });
}

function ProfileChipSection({
  title,
  hint,
  options,
  selectedValues,
  onSelect,
  optionGroup,
  locale,
}: {
  title: string;
  hint: string;
  options: string[];
  selectedValues: string[];
  onSelect: (value: string) => void;
  optionGroup: "occasions" | "seasons" | "audience" | "patterns";
  locale: string;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">
        {hint}
      </Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {options.map((item) => (
          <Chip
            key={item}
            label={translateOption(optionGroup, item, locale)}
            clickable
            color={selectedValues.includes(item) ? "primary" : "default"}
            onClick={() => onSelect(item)}
          />
        ))}
      </Stack>
    </Stack>
  );
}

function ProfileActions({
  status,
  selectedStyleCore,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  onBack,
  onSave,
  onOpenDelete,
  t,
}: {
  status: ScreenStatus;
  selectedStyleCore: string;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string;
  onBack: () => void;
  onSave: () => void;
  onOpenDelete: () => void;
  t: (key: string) => string;
}) {
  const isSaveDisabled =
    status.loading ||
    !selectedStyleCore ||
    selectedOccasions.length === 0 ||
    selectedSeasons.length === 0 ||
    !selectedAudience;

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      <Button variant="outlined" onClick={onBack}>
        {t("profile.back")}
      </Button>
      <Button variant="contained" onClick={onSave} disabled={isSaveDisabled}>
        {t("profile.save")}
      </Button>
      <Button
        variant="text"
        color="error"
        onClick={onOpenDelete}
        disabled={status.loading}
      >
        {t("profile.delete")}
      </Button>
    </Stack>
  );
}

function DeleteProfileDialog({
  open,
  loading,
  onClose,
  onConfirm,
  t,
}: {
  open: boolean;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: (key: string) => string;
}) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("profile.deleteConfirmTitle")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("profile.deleteConfirmBody")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          {t("profile.deleteConfirmCancel")}
        </Button>
        <Button
          onClick={onConfirm}
          color="error"
          variant="contained"
          disabled={loading}
        >
          {t("profile.deleteConfirmConfirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ProfilePreferenceSections({
  props,
  normalizedSelectedPattern,
  sortedPatternOptions,
  onOpenDelete,
  t,
  locale,
}: {
  props: ProfileScreenProps;
  normalizedSelectedPattern: string;
  sortedPatternOptions: string[];
  onOpenDelete: () => void;
  t: (key: string) => string;
  locale: string;
}) {
  return (
    <>
      <StylePreferenceSelector
        styleOptions={props.styleOptions}
        selectedStyleCore={props.selectedStyleCore}
        selectedStyleAesthetic={props.selectedStyleAesthetic}
        onSelectStyleCore={props.onSelectStyleCore}
        onSelectStyleAesthetic={props.onSelectStyleAesthetic}
        titleVariant="h6"
        bodyVariant="body2"
      />
      <ProfileChipSection
        title={t("profile.occasionsTitle")}
        hint={t("profile.occasionsHint")}
        options={props.occasionOptions}
        selectedValues={props.selectedOccasions}
        onSelect={props.onToggleOccasion}
        optionGroup="occasions"
        locale={locale}
      />
      <ProfileChipSection
        title={t("profile.seasonsTitle")}
        hint={t("profile.seasonsHint")}
        options={props.seasonOptions}
        selectedValues={props.selectedSeasons}
        onSelect={props.onToggleSeason}
        optionGroup="seasons"
        locale={locale}
      />
      <ProfileChipSection
        title={t("profile.audienceTitle")}
        hint={t("profile.audienceHint")}
        options={props.audienceOptions}
        selectedValues={[props.selectedAudience]}
        onSelect={props.onSelectAudience}
        optionGroup="audience"
        locale={locale}
      />
      <Stack spacing={2}>
        <Typography variant="h6">{t("profile.accentColorTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {t("profile.accentColorHint")}
        </Typography>
        <AccentColorChips
          options={props.accentColorOptions}
          selectedValue={props.selectedAccentColor}
          onSelect={props.onSelectAccentColor}
        />
      </Stack>
      <ProfileChipSection
        title={t("profile.patternTitle")}
        hint={t("profile.patternHint")}
        options={sortedPatternOptions}
        selectedValues={[normalizedSelectedPattern]}
        onSelect={props.onSelectPattern}
        optionGroup="patterns"
        locale={locale}
      />
      <ProfileActions
        status={props.status}
        selectedStyleCore={props.selectedStyleCore}
        selectedOccasions={props.selectedOccasions}
        selectedSeasons={props.selectedSeasons}
        selectedAudience={props.selectedAudience}
        onBack={props.onBack}
        onSave={props.onSave}
        onOpenDelete={onOpenDelete}
        t={t}
      />
    </>
  );
}

function ProfileScreen(props: ProfileScreenProps) {
  const { patternOptions, selectedPattern, status, onDelete } = props;
  const { t, locale } = useI18n();
  const normalizedSelectedPattern = selectedPattern ?? "solid";
  const sortedPatternOptions = sortPatternOptions(patternOptions, locale);
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
          pb: 1,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Typography variant="h4">{t("profile.title")}</Typography>
          <LocaleSwitcher />
        </Stack>
      </Box>

      <Divider />

      <Typography variant="body2" color="text.secondary">
        {t("profile.subtitle")}
      </Typography>

      <ProfilePreferenceSections
        props={props}
        normalizedSelectedPattern={normalizedSelectedPattern}
        sortedPatternOptions={sortedPatternOptions}
        onOpenDelete={handleOpenDelete}
        t={t}
        locale={locale}
      />

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
      <DeleteProfileDialog
        open={isDeleteOpen}
        loading={status.loading}
        onClose={handleCloseDelete}
        onConfirm={handleConfirmDelete}
        t={t}
      />
    </Stack>
  );
}

export default ProfileScreen;
