import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import {
  Box,
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
import {
  settingsDialogMobileMotionPanelSx,
  settingsDialogMobileMotionTrackSx,
  settingsDialogMobileMotionViewportSx,
  settingsDialogMobileSectionSx,
} from "./SettingsDialogLayoutStyles";
import { SettingsSectionContent } from "./SettingsDialogSectionContent";

type Translate = (key: string, params?: unknown) => string;
type SettingsMobileView = "index" | "section";
type SettingsMobileTransitionDirection = "forward" | "back";

type SettingsMobileBodyProps = {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  error: string;
  isPasskeyLoading: boolean;
  isRemoveAccountDisabled: boolean;
  locale: string;
  mobileTransitionDirection: SettingsMobileTransitionDirection;
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
        spacing={1}
        sx={{ alignItems: "center", minWidth: 0 }}
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
  const isSectionView = props.mobileView === "section";
  const isIndexView = !isSectionView;

  return (
    <Box
      data-settings-mobile-motion="viewport"
      data-settings-mobile-transition={props.mobileTransitionDirection}
      sx={settingsDialogMobileMotionViewportSx}
    >
      <Box
        data-settings-mobile-motion="track"
        sx={settingsDialogMobileMotionTrackSx}
      >
        <SettingsMobilePanel
          inactiveTransform="translate3d(-100%, 0, 0)"
          isActive={isIndexView}
          panel="index"
          spacing={2}
        >
          <SettingsMobileSectionsList
            onSelectSection={props.onSelectSection}
            t={props.t}
          />
          <SettingsMobileError error={props.error} />
        </SettingsMobilePanel>
        <SettingsMobilePanel
          inactiveTransform="translate3d(100%, 0, 0)"
          isActive={isSectionView}
          panel="section"
          spacing={2}
          sx={settingsDialogMobileSectionSx}
        >
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
        </SettingsMobilePanel>
      </Box>
    </Box>
  );
}

function SettingsMobilePanel({
  children,
  inactiveTransform,
  isActive,
  panel,
  spacing,
  sx = {},
}: {
  children: ReactNode;
  inactiveTransform: string;
  isActive: boolean;
  panel: "index" | "section";
  spacing: number;
  sx?: Record<string, unknown>;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const panelElement = panelRef.current;

    if (!panelElement) {
      return;
    }

    if (isActive) {
      panelElement.removeAttribute("inert");
      return;
    }

    panelElement.setAttribute("inert", "");
  }, [isActive]);

  return (
    <Stack
      ref={panelRef}
      aria-hidden={!isActive}
      data-settings-mobile-panel={panel}
      spacing={spacing}
      sx={{
        ...getSettingsMobilePanelSx(isActive, inactiveTransform),
        ...sx,
      }}
    >
      {children}
    </Stack>
  );
}

function getSettingsMobilePanelSx(
  isActive: boolean,
  inactiveTransform: string,
) {
  return {
    ...settingsDialogMobileMotionPanelSx,
    inset: isActive ? undefined : 0,
    opacity: isActive ? 1 : 0.85,
    pointerEvents: isActive ? "auto" : "none",
    position: isActive ? "relative" : "absolute",
    transform: isActive ? "translate3d(0, 0, 0)" : inactiveTransform,
  } as const;
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
            slotProps={{ primary: { sx: { fontWeight: 700 } } }}
          />
          <ChevronRightRoundedIcon color="action" />
        </ListItemButton>
      ))}
    </List>
  );
}

const settingsMobileSectionButtonSx = {
  borderRadius: "var(--cw-radius-card)",
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
export type { SettingsMobileTransitionDirection, SettingsMobileView };
