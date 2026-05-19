import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { mobileCapsuleDialogTitleSx } from "./MobileDialogSurfaceStyles";
import {
  SETTINGS_SECTIONS,
  type PasskeyMetadata,
  type SettingsDraft,
  type SettingsSection,
} from "./settingsDialogModel";
import { settingsDialogMobileSectionSx } from "./SettingsDialogLayoutStyles";
import { SettingsSectionContent } from "./SettingsDialogSectionContent";

type Translate = (key: string, params?: unknown) => string;
type SettingsMobileView = "index" | "section";

type SettingsMobileBodyProps = {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  error: string;
  isPasskeyLoading: boolean;
  isRemoveAccountDisabled: boolean;
  locale: string;
  mobileView: SettingsMobileView;
  onAddPasskey: () => void;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onRequestRemoveAccount: () => void;
  onSelectSection: (section: SettingsSection) => void;
  passkeys: PasskeyMetadata[];
  t: Translate;
};

function SettingsMobileDialogTitle({
  activeSection,
  mobileView,
  onBack,
  t,
}: {
  activeSection: SettingsSection;
  mobileView: SettingsMobileView;
  onBack: () => void;
  t: Translate;
}) {
  const title =
    mobileView === "section"
      ? t(`settings.sections.${activeSection}`)
      : t("settings.title");

  return (
    <DialogTitle sx={mobileCapsuleDialogTitleSx}>
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{ minWidth: 0 }}
      >
        {mobileView === "section" ? (
          <IconButton
            edge="start"
            aria-label={t("profile.back")}
            onClick={onBack}
            sx={{ flexShrink: 0 }}
          >
            <ArrowBackRoundedIcon />
          </IconButton>
        ) : null}
        <Typography
          component="span"
          variant="h6"
          sx={{
            color: "text.primary",
            flex: "1 1 auto",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </Typography>
      </Stack>
    </DialogTitle>
  );
}

function SettingsMobileDialogBody(props: SettingsMobileBodyProps) {
  if (props.mobileView === "index") {
    return (
      <Stack spacing={2}>
        <SettingsMobileSectionsList
          onSelectSection={props.onSelectSection}
          t={props.t}
        />
        <SettingsMobileError error={props.error} />
      </Stack>
    );
  }

  return (
    <Stack spacing={2} sx={settingsDialogMobileSectionSx}>
      <Typography variant="body2" color="text.secondary">
        {props.t(`settings.sectionHints.${props.activeSection}`)}
      </Typography>
      <SettingsSectionContent
        activeSection={props.activeSection}
        draft={props.draft}
        passkeys={props.passkeys}
        locale={props.locale}
        isPasskeyLoading={props.isPasskeyLoading}
        isRemoveAccountDisabled={props.isRemoveAccountDisabled}
        onDraftChange={props.onDraftChange}
        onAddPasskey={props.onAddPasskey}
        onRequestDelete={props.onRequestDelete}
        onRequestRemoveAccount={props.onRequestRemoveAccount}
        t={props.t}
      />
      <SettingsMobileError error={props.error} />
    </Stack>
  );
}

function SettingsMobileError({ error }: { error: string }) {
  if (!error) {
    return null;
  }

  return (
    <Typography variant="body2" color="error">
      {error}
    </Typography>
  );
}

function SettingsMobileSectionsList({
  onSelectSection,
  t,
}: {
  onSelectSection: (section: SettingsSection) => void;
  t: Translate;
}) {
  return (
    <List sx={settingsMobileSectionsListSx}>
      {SETTINGS_SECTIONS.map((section) => (
        <ListItemButton
          key={section}
          onClick={() => onSelectSection(section)}
          sx={settingsMobileSectionButtonSx}
        >
          <ListItemText
            primary={t(`settings.sections.${section}`)}
            primaryTypographyProps={{ fontWeight: 700 }}
          />
          <ChevronRightRoundedIcon color="action" />
        </ListItemButton>
      ))}
    </List>
  );
}

const settingsMobileSectionButtonSx = {
  borderRadius: "8px",
  minHeight: 56,
  px: 2,
  py: 1.25,
  "& + &": {
    mt: 0.75,
  },
  bgcolor: "background.paper",
  border: "1px solid",
  borderColor: "divider",
} as const;

const settingsMobileSectionsListSx = {
  py: 0,
} as const;

export { SettingsMobileDialogBody, SettingsMobileDialogTitle };
export type { SettingsMobileView };
