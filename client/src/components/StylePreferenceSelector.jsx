import { Chip, Stack, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n/index.js";

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
  const coreOptions = styleOptions?.core || [];
  const aestheticsOptions = styleOptions?.aesthetics || [];

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
              key={style.value}
              label={translateOption("styles", style.value, locale)}
              clickable={!style.disabled}
              disabled={style.disabled}
              color={selectedStyleCore === style.value ? "primary" : "default"}
              onClick={style.disabled ? undefined : () => onSelectStyleCore(style.value)}
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
              key={style.value}
              label={translateOption("styles", style.value, locale)}
              clickable={!style.disabled}
              disabled={style.disabled}
              color={selectedStyleAesthetic === style.value ? "primary" : "default"}
              onClick={style.disabled ? undefined : () => onSelectStyleAesthetic(style.value)}
            />
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}

export default StylePreferenceSelector;
