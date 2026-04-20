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

function OnboardingScreen({
  onboardingStep,
  styleOptions,
  occasionOptions,
  seasonOptions,
  audienceOptions,
  selectedStyleCore,
  selectedStyleAesthetic,
  selectedOccasions,
  selectedSeasons,
  selectedAudience,
  status,
  onSelectStyleCore,
  onSelectStyleAesthetic,
  onToggleOccasion,
  onToggleSeason,
  onSelectAudience,
  onNext,
  onBack,
  onFinish
}: OnboardingScreenProps) {
  const { t, locale } = useI18n();
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography
            sx={{
              fontFamily: '"Leckerli One", cursive',
              fontSize: "1.85rem",
              lineHeight: 1.1,
              color: "#8f6f45",
              textAlign: "left"
            }}
          >
            {t("appName")}
          </Typography>
          <LocaleSwitcher />
        </Stack>
        <Typography variant="body2" color="text.secondary">
          {t("onboarding.subtitle")}
        </Typography>
      </Stack>

      <Divider />

      {onboardingStep === 0 ? (
        <Stack spacing={2}>
          <Typography variant="h6">{t("onboarding.step1Title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("onboarding.step1Hint")}
          </Typography>
          <StylePreferenceSelector
            styleOptions={styleOptions}
            selectedStyleCore={selectedStyleCore}
            selectedStyleAesthetic={selectedStyleAesthetic}
            onSelectStyleCore={onSelectStyleCore}
            onSelectStyleAesthetic={onSelectStyleAesthetic}
            showSectionHeading={false}
            bodyVariant="body2"
          />
        </Stack>
      ) : null}

      {onboardingStep === 1 ? (
        <Stack spacing={2}>
          <Typography variant="h6">{t("onboarding.step2Title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("onboarding.step2Hint")}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {occasionOptions.map((item) => (
              <Chip
                key={item}
                label={translateOption("occasions", item, locale)}
                clickable
                color={selectedOccasions.includes(item) ? "primary" : "default"}
                onClick={() => onToggleOccasion(item)}
              />
            ))}
          </Stack>
        </Stack>
      ) : null}

      {onboardingStep === 2 ? (
        <Stack spacing={2}>
          <Typography variant="h6">{t("onboarding.step3Title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("onboarding.step3Hint")}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {seasonOptions.map((item) => (
              <Chip
                key={item}
                label={translateOption("seasons", item, locale)}
                clickable
                color={selectedSeasons.includes(item) ? "primary" : "default"}
                onClick={() => onToggleSeason(item)}
              />
            ))}
          </Stack>
        </Stack>
      ) : null}

      {onboardingStep === 3 ? (
        <Stack spacing={2}>
          <Typography variant="h6">{t("onboarding.step4Title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("onboarding.step4Hint")}
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {audienceOptions.map((item) => (
              <Chip
                key={item}
                label={translateOption("audience", item, locale)}
                clickable
                color={selectedAudience === item ? "primary" : "default"}
                onClick={() => onSelectAudience(item)}
              />
            ))}
          </Stack>
        </Stack>
      ) : null}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        {onboardingStep > 0 ? (
          <Button variant="outlined" onClick={onBack}>
            {t("profile.back")}
          </Button>
        ) : null}
        {onboardingStep < 3 ? (
          <Button
            variant="contained"
            onClick={onNext}
            disabled={
              (onboardingStep === 0 && !selectedStyleCore) ||
              (onboardingStep === 1 && selectedOccasions.length === 0) ||
              (onboardingStep === 2 && selectedSeasons.length === 0)
            }
          >
            {t("onboarding.next")}
          </Button>
        ) : (
          <Button variant="contained" onClick={onFinish} disabled={!selectedAudience}>
            {t("onboarding.start")}
          </Button>
        )}
      </Stack>

      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
      {status.infoKey ? (
        <Typography variant="body2" color="text.secondary">
          {t(status.infoKey, status.infoParams || undefined)}
        </Typography>
      ) : null}
    </Stack>
  );
}

export default OnboardingScreen;
