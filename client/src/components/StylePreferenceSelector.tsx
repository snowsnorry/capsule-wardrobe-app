import { Chip, Stack, Typography } from "@mui/material";
import type { TypographyProps } from "@mui/material/Typography";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";
import { ProfileFilterSelectSection } from "./ProfileFilterSelectSection";

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
  aestheticControl?: "chips" | "select";
};

type StyleSectionProps = {
  bodyVariant: TypographyProps["variant"];
  disabled: boolean;
  locale: string;
  t: (key: string) => string;
};

function sortCoreOptions(items: StyleOption[]): StyleOption[] {
  return [...items].sort((left, right) => {
    const leftIndex = CORE_DISPLAY_ORDER.indexOf(left as CoreDisplayStyle);
    const rightIndex = CORE_DISPLAY_ORDER.indexOf(right as CoreDisplayStyle);
    const normalizedLeft =
      leftIndex === -1 ? CORE_DISPLAY_ORDER.length : leftIndex;
    const normalizedRight =
      rightIndex === -1 ? CORE_DISPLAY_ORDER.length : rightIndex;

    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }

    return String(left).localeCompare(String(right));
  });
}

function sortAestheticOptions(
  items: StyleOption[],
  locale: string,
): StyleOption[] {
  return [...items].sort((left, right) =>
    translateOption("styles", left, locale).localeCompare(
      translateOption("styles", right, locale),
      locale,
    ),
  );
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
  bodyVariant = "body1",
  aestheticControl = "chips",
}: StylePreferenceSelectorProps) {
  const { t, locale } = useI18n();
  const coreOptions = sortCoreOptions(styleOptions?.core || []);
  const aestheticsOptions = sortAestheticOptions(
    styleOptions?.aesthetics || [],
    locale,
  );

  return (
    <Stack spacing={2}>
      {showSectionHeading ? (
        <Stack spacing={1.5}>
          <Typography variant={titleVariant}>
            {t("profile.stylesTitle")}
          </Typography>
          <Typography variant={bodyVariant} color="text.secondary">
            {t("profile.stylesHint")}
          </Typography>
        </Stack>
      ) : null}

      <CoreStyleSection
        bodyVariant={bodyVariant}
        disabled={disabled}
        locale={locale}
        options={coreOptions}
        selectedStyleCore={selectedStyleCore}
        onSelectStyleCore={onSelectStyleCore}
        t={t}
      />

      <AestheticStyleSection
        aestheticControl={aestheticControl}
        bodyVariant={bodyVariant}
        disabled={disabled}
        locale={locale}
        options={aestheticsOptions}
        selectedStyleAesthetic={selectedStyleAesthetic}
        onSelectStyleAesthetic={onSelectStyleAesthetic}
        t={t}
      />
    </Stack>
  );
}

function CoreStyleSection({
  bodyVariant,
  disabled,
  locale,
  options,
  selectedStyleCore,
  onSelectStyleCore,
  t,
}: StyleSectionProps & {
  options: StyleOption[];
  selectedStyleCore: StyleOption | null;
  onSelectStyleCore: (style: StyleOption) => void;
}) {
  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant={bodyVariant} sx={{ fontWeight: 600 }}>
          {t("profile.styleCoreTitle")}
        </Typography>
        <Typography variant={bodyVariant} color="text.secondary">
          {t("profile.styleCoreHint")}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {options.map((style) => (
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
  );
}

function AestheticStyleSection({
  aestheticControl,
  bodyVariant,
  disabled,
  locale,
  options,
  selectedStyleAesthetic,
  onSelectStyleAesthetic,
  t,
}: StyleSectionProps & {
  aestheticControl: "chips" | "select";
  options: StyleOption[];
  selectedStyleAesthetic: StyleOption | null;
  onSelectStyleAesthetic: (style: StyleOption | null) => void;
}) {
  if (aestheticControl === "select") {
    return (
      <ProfileFilterSelectSection
        title={t("profile.styleAestheticTitle")}
        hint={t("profile.styleAestheticHint")}
        options={options}
        selectedValue={selectedStyleAesthetic}
        optionGroup="styles"
        locale={locale}
        disabled={disabled}
        onSelect={onSelectStyleAesthetic}
        emptyOption={{
          value: "",
          label: t("profile.styleAestheticNotImportant"),
        }}
      />
    );
  }

  return (
    <Stack spacing={1.5}>
      <Stack spacing={0.5}>
        <Typography variant={bodyVariant} sx={{ fontWeight: 600 }}>
          {t("profile.styleAestheticTitle")}
        </Typography>
        <Typography variant={bodyVariant} color="text.secondary">
          {t("profile.styleAestheticHint")}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        <Chip
          label={t("profile.styleAestheticNotImportant")}
          clickable
          disabled={disabled}
          color={selectedStyleAesthetic === null ? "primary" : "default"}
          onClick={() => onSelectStyleAesthetic(null)}
        />
        {options.map((style) => (
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
  );
}

export default StylePreferenceSelector;
