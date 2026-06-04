import { useEffect, useState } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
  SETTINGS_SECTIONS,
  type PasskeyMetadata,
  type SettingsDraft,
  type SettingsSection,
} from "./settingsDialogModel";
import {
  settingsDialogBodySx,
  settingsDialogContentSx,
  settingsDialogMainPanelSx,
  settingsDialogMobileContentSx,
  settingsDialogMobilePaperSx,
  settingsDialogPaperSx,
} from "./SettingsDialogLayoutStyles";
import {
  SettingsMobileDialogBody,
  SettingsMobileDialogTitle,
  type SettingsMobileTransitionDirection,
  type SettingsMobileView,
} from "./SettingsDialogMobile";
import {
  PasskeyDeleteDialog,
  SettingsDialogActions,
  SettingsDialogProgress,
} from "./SettingsDialogShellParts";
import { SettingsSectionContent } from "./SettingsDialogSectionContent";
import { SettingsRemoveAccountDialog } from "./SettingsRemoveAccountDialog";

type Translate = (key: string, params?: unknown) => string;

type SettingsDialogFrameProps = {
  open: boolean;
  activeSection: SettingsSection;
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isSaving: boolean;
  isPasskeyLoading: boolean;
  isRemoveAccountOpen: boolean;
  isRemovingAccount: boolean;
  hasChanges: boolean;
  error: string;
  passkeyToDelete: PasskeyMetadata | null;
  removeAccountConfirmation: string;
  onClose: () => void;
  onSave: () => void;
  onSelectSection: (section: SettingsSection) => void;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onRequestRemoveAccount: () => void;
  onClosePasskeyDelete: () => void;
  onConfirmPasskeyDelete: () => void;
  onCloseRemoveAccount: () => void;
  onConfirmRemoveAccount: () => void;
  onRemoveAccountConfirmationChange: (value: string) => void;
  t: Translate;
};

type SettingsDialogContentPaneProps = SettingsDialogFrameProps & {
  isBusy: boolean;
  isMobile: boolean;
  mobileTransitionDirection: SettingsMobileTransitionDirection;
  mobileView: SettingsMobileView;
  onMobileSectionSelect: (section: SettingsSection) => void;
};

function SettingsDialogFrame(props: SettingsDialogFrameProps) {
  const isBusy = props.isSaving || props.isRemovingAccount;
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [mobileView, setMobileView] = useState<SettingsMobileView>("index");
  const [mobileTransitionDirection, setMobileTransitionDirection] =
    useState<SettingsMobileTransitionDirection>("forward");

  useEffect(() => {
    if (props.open) {
      setMobileView("index");
      setMobileTransitionDirection("forward");
    }
  }, [props.open]);

  const handleMobileSectionSelect = (section: SettingsSection) => {
    props.onSelectSection(section);
    setMobileTransitionDirection("forward");
    setMobileView("section");
  };

  const handleMobileBack = () => {
    setMobileTransitionDirection("back");
    setMobileView("index");
  };

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      fullScreen={isMobile}
      fullWidth
      maxWidth={isMobile ? false : "md"}
      slotProps={{
        paper: {
          sx: isMobile ? settingsDialogMobilePaperSx : settingsDialogPaperSx,
        },
      }}
    >
      {isMobile ? (
        <SettingsMobileDialogTitle
          activeSection={props.activeSection}
          mobileView={mobileView}
          onBack={handleMobileBack}
          t={props.t}
        />
      ) : (
        <DialogTitle>{props.t("settings.title")}</DialogTitle>
      )}
      <SettingsDialogProgress isMobile={isMobile} isSaving={isBusy} />
      <SettingsDialogContentPane
        {...props}
        isBusy={isBusy}
        isMobile={isMobile}
        mobileTransitionDirection={mobileTransitionDirection}
        mobileView={mobileView}
        onMobileSectionSelect={handleMobileSectionSelect}
      />
      <SettingsDialogActions
        hasChanges={props.hasChanges}
        isSaving={isBusy}
        isMobile={isMobile}
        onClose={props.onClose}
        onSave={props.onSave}
        t={props.t}
      />
      <PasskeyDeleteDialog
        passkeyToDelete={props.passkeyToDelete}
        isPasskeyLoading={props.isPasskeyLoading}
        onClose={props.onClosePasskeyDelete}
        onConfirm={props.onConfirmPasskeyDelete}
        t={props.t}
      />
      {props.isRemoveAccountOpen ? (
        <SettingsRemoveAccountDialog
          confirmation={props.removeAccountConfirmation}
          confirmationWord={props.t("settings.removeAccount.confirmationWord")}
          isRemoving={props.isRemovingAccount}
          onClose={props.onCloseRemoveAccount}
          onConfirm={props.onConfirmRemoveAccount}
          onConfirmationChange={props.onRemoveAccountConfirmationChange}
          t={props.t}
        />
      ) : null}
    </Dialog>
  );
}

function SettingsDialogContentPane(props: SettingsDialogContentPaneProps) {
  return (
    <DialogContent
      sx={
        props.isMobile ? settingsDialogMobileContentSx : settingsDialogContentSx
      }
    >
      {props.isMobile ? (
        <SettingsMobileDialogBody
          activeSection={props.activeSection}
          draft={props.draft}
          error={props.error}
          isPasskeyLoading={props.isPasskeyLoading}
          isRemoveAccountDisabled={props.isBusy}
          locale={props.locale}
          mobileTransitionDirection={props.mobileTransitionDirection}
          mobileView={props.mobileView}
          onAddPasskey={props.onAddPasskey}
          onDraftChange={props.onDraftChange}
          onRequestDelete={props.onRequestDelete}
          onRequestRemoveAccount={props.onRequestRemoveAccount}
          onSelectSection={props.onMobileSectionSelect}
          passkeys={props.passkeys}
          t={props.t}
        />
      ) : (
        <SettingsDialogBody
          activeSection={props.activeSection}
          draft={props.draft}
          error={props.error}
          isPasskeyLoading={props.isPasskeyLoading}
          isRemoveAccountDisabled={props.isBusy}
          locale={props.locale}
          onAddPasskey={props.onAddPasskey}
          onDraftChange={props.onDraftChange}
          onRequestDelete={props.onRequestDelete}
          onRequestRemoveAccount={props.onRequestRemoveAccount}
          onSelectSection={props.onSelectSection}
          passkeys={props.passkeys}
          t={props.t}
        />
      )}
    </DialogContent>
  );
}

function SettingsDialogBody({
  activeSection,
  draft,
  error,
  isPasskeyLoading,
  isRemoveAccountDisabled,
  locale,
  onAddPasskey,
  onDraftChange,
  onRequestDelete,
  onRequestRemoveAccount,
  onSelectSection,
  passkeys,
  t,
}: {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  error: string;
  isPasskeyLoading: boolean;
  isRemoveAccountDisabled: boolean;
  locale: string;
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
}) {
  return (
    <Box sx={settingsDialogBodySx}>
      <SettingsSectionsList
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        t={t}
      />
      <Stack spacing={2} sx={settingsDialogMainPanelSx}>
        <Typography variant="body2" color="text.secondary">
          {t(`settings.sectionHints.${activeSection}`)}
        </Typography>
        <SettingsSectionContent
          activeSection={activeSection}
          draft={draft}
          passkeys={passkeys}
          locale={locale}
          isPasskeyLoading={isPasskeyLoading}
          isRemoveAccountDisabled={isRemoveAccountDisabled}
          onDraftChange={onDraftChange}
          onAddPasskey={onAddPasskey}
          onRequestDelete={onRequestDelete}
          onRequestRemoveAccount={onRequestRemoveAccount}
          t={t}
        />
        {error ? (
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}

function SettingsSectionsList({
  activeSection,
  onSelectSection,
  t,
}: {
  activeSection: SettingsSection;
  onSelectSection: (section: SettingsSection) => void;
  t: Translate;
}) {
  return (
    <List sx={settingsSectionsListSx}>
      {SETTINGS_SECTIONS.map((section) => {
        const isActive = activeSection === section;

        return (
          <ListItemButton
            key={section}
            selected={isActive}
            onClick={() => onSelectSection(section)}
            sx={settingsSectionButtonSx}
          >
            <ListItemText
              primary={t(`settings.sections.${section}`)}
              slotProps={{
                primary: {
                  sx: {
                    fontWeight: isActive ? 700 : 500,
                  },
                },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

const settingsSectionButtonSx = {
  borderRadius: "var(--cw-radius-card)",
  mb: 0.25,
  minHeight: 40,
} as const;

const settingsSectionsListSx = {
  py: 0,
  borderRight: { sm: "1px solid" },
  borderColor: { sm: "divider" },
  pr: { sm: 2 },
} as const;

export { SettingsDialogFrame };
