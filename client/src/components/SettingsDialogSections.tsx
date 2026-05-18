import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Typography,
} from "@mui/material";
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
  settingsDialogPaperSx,
} from "./SettingsDialogLayoutStyles";
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

function PasskeyDeleteDialog({
  passkeyToDelete,
  isPasskeyLoading,
  onClose,
  onConfirm,
  t,
}: {
  passkeyToDelete: PasskeyMetadata | null;
  isPasskeyLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
  t: Translate;
}) {
  return (
    <Dialog open={Boolean(passkeyToDelete)} onClose={onClose}>
      <DialogTitle>{t("passkeys.remove")}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t("passkeys.removeConfirm")}</DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button disabled={isPasskeyLoading} onClick={onClose}>
          {t("actions.cancel")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={isPasskeyLoading}
          onClick={onConfirm}
        >
          {t("passkeys.remove")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SettingsDialogFrame({
  open,
  activeSection,
  draft,
  passkeys,
  locale,
  isSaving,
  isPasskeyLoading,
  isRemoveAccountOpen,
  isRemovingAccount,
  hasChanges,
  error,
  passkeyToDelete,
  removeAccountConfirmation,
  onClose,
  onSave,
  onSelectSection,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  onRequestRemoveAccount,
  onClosePasskeyDelete,
  onConfirmPasskeyDelete,
  onCloseRemoveAccount,
  onConfirmRemoveAccount,
  onRemoveAccountConfirmationChange,
  t,
}: SettingsDialogFrameProps) {
  const isBusy = isSaving || isRemovingAccount;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="md"
      PaperProps={{ sx: settingsDialogPaperSx }}
    >
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <SettingsDialogProgress isSaving={isBusy} />
      <DialogContent sx={settingsDialogContentSx}>
        <SettingsDialogBody
          activeSection={activeSection}
          draft={draft}
          error={error}
          isPasskeyLoading={isPasskeyLoading}
          isRemoveAccountDisabled={isBusy}
          locale={locale}
          onAddPasskey={onAddPasskey}
          onDraftChange={onDraftChange}
          onRequestDelete={onRequestDelete}
          onRequestRemoveAccount={onRequestRemoveAccount}
          onSelectSection={onSelectSection}
          passkeys={passkeys}
          t={t}
        />
      </DialogContent>
      <SettingsDialogActions
        hasChanges={hasChanges}
        isSaving={isBusy}
        onClose={onClose}
        onSave={onSave}
        t={t}
      />
      <PasskeyDeleteDialog
        passkeyToDelete={passkeyToDelete}
        isPasskeyLoading={isPasskeyLoading}
        onClose={onClosePasskeyDelete}
        onConfirm={onConfirmPasskeyDelete}
        t={t}
      />
      {isRemoveAccountOpen ? (
        <SettingsRemoveAccountDialog
          confirmation={removeAccountConfirmation}
          confirmationWord={t("settings.removeAccount.confirmationWord")}
          isRemoving={isRemovingAccount}
          onClose={onCloseRemoveAccount}
          onConfirm={onConfirmRemoveAccount}
          onConfirmationChange={onRemoveAccountConfirmationChange}
          t={t}
        />
      ) : null}
    </Dialog>
  );
}

function SettingsDialogProgress({ isSaving }: { isSaving: boolean }) {
  return (
    <Box sx={{ px: 3, pb: 0.5 }}>
      <Divider sx={{ borderColor: "divider" }} />
      {isSaving ? (
        <LinearProgress
          color="success"
          sx={{
            mt: "-2px",
            height: 3,
            borderRadius: 999,
            backgroundColor: "action.hover",
            "& .MuiLinearProgress-bar": { borderRadius: 999 },
          }}
        />
      ) : null}
    </Box>
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
              primaryTypographyProps={{
                fontWeight: isActive ? 700 : 500,
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

const settingsSectionButtonSx = {
  borderRadius: "8px",
  mb: 0.25,
  minHeight: 40,
} as const;

const settingsSectionsListSx = {
  py: 0,
  borderRight: { sm: "1px solid" },
  borderColor: { sm: "divider" },
  pr: { sm: 2 },
} as const;

function SettingsDialogActions({
  hasChanges,
  isSaving,
  onClose,
  onSave,
  t,
}: {
  hasChanges: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  t: Translate;
}) {
  return (
    <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
      <Button onClick={onClose} disabled={isSaving}>
        {t("actions.cancel")}
      </Button>
      <Button
        variant="contained"
        onClick={onSave}
        disabled={isSaving || !hasChanges}
      >
        {t("actions.save")}
      </Button>
    </DialogActions>
  );
}

export { SettingsDialogFrame };
