import { Chip, Stack, Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material/Typography";
import { useI18n } from "../i18n/useI18n.js";
import { translateOption } from "../i18n";

const CORE_DISPLAY_ORDER = ["casual", "smart_casual", "formal"] as const;

type CoreDisplayStyle = (typeof CORE_DISPLAY_ORDER)[number];
type StyleOption = string;

type StyleOptions = {
  core?: StyleOption[];
  aesthetics?: StyleOption[];
};

type StylePreferenceSelectorProps = {
  styleOptions: StyleOptions;
  selectedStyleCore: StyleOption | null;
  selectedStyleAesthetic: StyleOption | null;
  onSelectStyleCore: (style: StyleOption) => void;
  onSelectStyleAesthetic: (style: StyleOption | null) => void;
  disabled?: boolean;
  showSectionHeading?: boolean;
  titleVariant?: TypographyProps["variant"];
  bodyVariant?: TypographyProps["variant"];
};

function sortCoreOptions(items: StyleOption[]): StyleOption[] {
  return [...items].sort((left, right) => {
    const leftIndex = CORE_DISPLAY_ORDER.indexOf(left as CoreDisplayStyle);
    const rightIndex = CORE_DISPLAY_ORDER.indexOf(right as CoreDisplayStyle);
    const normalizedLeft = leftIndex === -1 ? CORE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight = rightIndex === -1 ? CORE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function sortAestheticOptions(items: StyleOption[], locale: string): StyleOption[] {
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
  disabled = false,
  showSectionHeading = true,
  titleVariant = "h5",
  bodyVariant = "body1"
}: StylePreferenceSelectorProps) {
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
              disabled={disabled}
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
            disabled={disabled}
            color={selectedStyleAesthetic === null ? "primary" : "default"}
            onClick={() => onSelectStyleAesthetic(null)}
          />
          {aestheticsOptions.map((style) => (
            <Chip
              key={style}
              label={translateOption("styles", style, locale)}
              clickable
              disabled={disabled}
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
