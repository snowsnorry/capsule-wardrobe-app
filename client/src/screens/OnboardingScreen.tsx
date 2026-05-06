import { Button, Chip, Divider, Stack, Typography } from "@mui/material";
import LocaleSwitcher from "../components/LocaleSwitcher";
import StylePreferenceSelector from "../components/StylePreferenceSelector";
import { useI18n } from "../i18n/useI18n";
import { translateOption } from "../i18n";

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

type OnboardingScreenProps = {
  onboardingStep: number;
  styleOptions: StyleOptions;
  occasionOptions: string[];
  seasonOptions: string[];
  audienceOptions: string[];
  selectedStyleCore: string;
  selectedStyleAesthetic: string | null;
  selectedOccasions: string[];
  selectedSeasons: string[];
  selectedAudience: string;
  status: ScreenStatus;
  onSelectStyleCore: (value: string) => void;
  onSelectStyleAesthetic: (value: string) => void;
  onToggleOccasion: (value: string) => void;
  onToggleSeason: (value: string) => void;
  onSelectAudience: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
};

function OnboardingHeader({ t }: { t: (key: string) => string }) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontFamily: '"Leckerli One", cursive', fontSize: "1.85rem", lineHeight: 1.1, color: "#8f6f45", textAlign: "left" }}>
          {t("appName")}
        </Typography>
        <LocaleSwitcher />
      </Stack>
      <Typography variant="body2" color="text.secondary">{t("onboarding.subtitle")}</Typography>
    </Stack>
  );
}

function OnboardingChipStep({
  title,
  hint,
  options,
  selectedValues,
  selectedValue,
  optionGroup,
  locale,
  onSelect
}: {
  title: string;
  hint: string;
  options: string[];
  selectedValues?: string[];
  selectedValue?: string;
  optionGroup: "occasions" | "seasons" | "audience";
  locale: string;
  onSelect: (value: string) => void;
}) {
  return (
    <Stack spacing={2}>
      <Typography variant="h6">{title}</Typography>
      <Typography variant="body2" color="text.secondary">{hint}</Typography>
      <Stack direction="row" flexWrap="wrap" gap={1}>
        {options.map((item) => (
          <Chip key={item} label={translateOption(optionGroup, item, locale)} clickable color={(selectedValues?.includes(item) || selectedValue === item) ? "primary" : "default"} onClick={() => onSelect(item)} />
        ))}
      </Stack>
    </Stack>
  );
}

function OnboardingStepContent({ props, t, locale }: { props: OnboardingScreenProps; t: (key: string) => string; locale: string }) {
  if (props.onboardingStep === 0) {
    return (
      <Stack spacing={2}>
        <Typography variant="h6">{t("onboarding.step1Title")}</Typography>
        <Typography variant="body2" color="text.secondary">{t("onboarding.step1Hint")}</Typography>
        <StylePreferenceSelector styleOptions={props.styleOptions} selectedStyleCore={props.selectedStyleCore} selectedStyleAesthetic={props.selectedStyleAesthetic} onSelectStyleCore={props.onSelectStyleCore} onSelectStyleAesthetic={props.onSelectStyleAesthetic} showSectionHeading={false} bodyVariant="body2" />
      </Stack>
    );
  }

  if (props.onboardingStep === 1) {
    return <OnboardingChipStep title={t("onboarding.step2Title")} hint={t("onboarding.step2Hint")} options={props.occasionOptions} selectedValues={props.selectedOccasions} optionGroup="occasions" locale={locale} onSelect={props.onToggleOccasion} />;
  }

  if (props.onboardingStep === 2) {
    return <OnboardingChipStep title={t("onboarding.step3Title")} hint={t("onboarding.step3Hint")} options={props.seasonOptions} selectedValues={props.selectedSeasons} optionGroup="seasons" locale={locale} onSelect={props.onToggleSeason} />;
  }

  return <OnboardingChipStep title={t("onboarding.step4Title")} hint={t("onboarding.step4Hint")} options={props.audienceOptions} selectedValue={props.selectedAudience} optionGroup="audience" locale={locale} onSelect={props.onSelectAudience} />;
}

function OnboardingActions({ props, t }: { props: OnboardingScreenProps; t: (key: string) => string }) {
  const isNextDisabled = (props.onboardingStep === 0 && !props.selectedStyleCore)
    || (props.onboardingStep === 1 && props.selectedOccasions.length === 0)
    || (props.onboardingStep === 2 && props.selectedSeasons.length === 0);

  return (
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
      {props.onboardingStep > 0 ? <Button variant="outlined" onClick={props.onBack}>{t("profile.back")}</Button> : null}
      {props.onboardingStep < 3 ? (
        <Button variant="contained" onClick={props.onNext} disabled={isNextDisabled}>{t("onboarding.next")}</Button>
      ) : (
        <Button variant="contained" onClick={props.onFinish} disabled={!props.selectedAudience}>{t("onboarding.start")}</Button>
      )}
    </Stack>
  );
}

function OnboardingStatus({ status, t }: { status: ScreenStatus; t: (key: string, params?: Record<string, unknown>) => string }) {
  return (
    <>
      {status.error ? <Typography variant="body2" color="error">{status.error}</Typography> : null}
      {status.infoKey ? <Typography variant="body2" color="text.secondary">{t(status.infoKey, status.infoParams || undefined)}</Typography> : null}
    </>
  );
}

function OnboardingScreen(props: OnboardingScreenProps) {
  const { t, locale } = useI18n();
  return (
    <Stack spacing={3}>
      <OnboardingHeader t={t} />
      <Divider />
      <OnboardingStepContent props={props} t={t} locale={locale} />
      <OnboardingActions props={props} t={t} />
      <OnboardingStatus status={props.status} t={t} />
    </Stack>
  );
}

export default OnboardingScreen;
