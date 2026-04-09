import { Chip, Stack, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

const CORE_DISPLAY_ORDER = ["casual", "smart_casual", "formal"];

function sortCoreOptions(items) {
  return [...items].sort((left, right) => {
    const leftIndex = CORE_DISPLAY_ORDER.indexOf(left);
    const rightIndex = CORE_DISPLAY_ORDER.indexOf(right);
    const normalizedLeft = leftIndex === -1 ? CORE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? CORE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function sortAestheticOptions(items, locale) {
  return [...items].sort((left, right) => (
    translateOption("styles", left, locale).localeCompare(
      translateOption("styles", right, locale),
      locale
    )
  ));
}

function StylePreferenceSelector({
  styleOptions,
  selectedStyleCore,
  selectedStyleAesthetic,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  showSectionHeading = true,
  titleVariant = "h5",
  bodyVariant = "body1"
}) {
  const { t, locale } = useI18n();
  const coreOptions = sortCoreOptions(styleOptions?.core || []);
  const aestheticsOptions = sortAestheticOptions(styleOptions?.aesthetics || [], locale);

  return (
    <Stack spacing={2}>
      {showSectionHeading ? (
        <Stack spacing={1.5}>
          <Typography variant={titleVariant}>{t("profile.stylesTitle")}</Typography>
          <Typography variant={bodyVariant} color="text.secondary">
            {t("profile.stylesHint")}
          </Typography>
        </Stack>
      ) : null}

      <Stack spacing={1.5}>
        <Typography variant={bodyVariant} sx={{ fontWeight: 600 }}>
          {t("profile.styleCoreTitle")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          {coreOptions.map((style) => (
            <Chip
              key={style}
              label={translateOption("styles", style, locale)}
              clickable
              color={selectedStyleCore === style ? "primary" : "default"}
              onClick={() => onSelectStyleCore(style)}
            />
          ))}
        </Stack>
      </Stack>

      <Stack spacing={1.5}>
        <Typography variant={bodyVariant} sx={{ fontWeight: 600 }}>
          {t("profile.styleAestheticTitle")}
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={1}>
          <Chip
            label={t("profile.styleAestheticNotImportant")}
            clickable
            color={selectedStyleAesthetic === null ? "primary" : "default"}
            onClick={() => onSelectStyleAesthetic(null)}
          />
          {aestheticsOptions.map((style) => (
            <Chip
              key={style}
              label={translateOption("styles", style, locale)}
              clickable
              color={selectedStyleAesthetic === style ? "primary" : "default"}
              onClick={() => onSelectStyleAesthetic(style)}
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

export default StylePreferenceSelector;
