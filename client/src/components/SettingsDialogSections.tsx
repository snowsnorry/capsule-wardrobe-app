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
import { SettingsSectionContent } from "./SettingsDialogSectionContent";

type Translate = (key: string, params?: unknown) => string;

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
  hasChanges,
  error,
  passkeyToDelete,
  onClose,
  onSave,
  onSelectSection,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  onClosePasskeyDelete,
  onConfirmPasskeyDelete,
  t,
}: {
  open: boolean;
  activeSection: SettingsSection;
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isSaving: boolean;
  isPasskeyLoading: boolean;
  hasChanges: boolean;
  error: string;
  passkeyToDelete: PasskeyMetadata | null;
  onClose: () => void;
  onSave: () => void;
  onSelectSection: (section: SettingsSection) => void;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onClosePasskeyDelete: () => void;
  onConfirmPasskeyDelete: () => void;
  t: Translate;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <SettingsDialogProgress isSaving={isSaving} />
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        <SettingsDialogBody
          activeSection={activeSection}
          draft={draft}
          error={error}
          isPasskeyLoading={isPasskeyLoading}
          locale={locale}
          onAddPasskey={onAddPasskey}
          onDraftChange={onDraftChange}
          onRequestDelete={onRequestDelete}
          onSelectSection={onSelectSection}
          passkeys={passkeys}
          t={t}
        />
      </DialogContent>
      <SettingsDialogActions
        hasChanges={hasChanges}
        isSaving={isSaving}
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
  locale,
  onAddPasskey,
  onDraftChange,
  onRequestDelete,
  onSelectSection,
  passkeys,
  t,
}: {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  error: string;
  isPasskeyLoading: boolean;
  locale: string;
  onAddPasskey: () => void;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
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
      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Typography variant="body2" color="text.secondary">
          {t(`settings.sectionHints.${activeSection}`)}
        </Typography>
        <SettingsSectionContent
          activeSection={activeSection}
          draft={draft}
          passkeys={passkeys}
          locale={locale}
          isPasskeyLoading={isPasskeyLoading}
          onDraftChange={onDraftChange}
          onAddPasskey={onAddPasskey}
          onRequestDelete={onRequestDelete}
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

const settingsDialogBodySx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0, 1fr)" },
  gap: 3,
  minHeight: { sm: 320 },
} as const;

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
      {SETTINGS_SECTIONS.map((section) => (
        <ListItemButton
          key={section}
          selected={activeSection === section}
          onClick={() => onSelectSection(section)}
          sx={{ borderRadius: 2, mb: 0.5 }}
        >
          <ListItemText primary={t(`settings.sections.${section}`)} />
        </ListItemButton>
      ))}
    </List>
  );
}

const settingsSectionsListSx = {
  py: 0,
  borderRight: { sm: "1px solid", borderColor: { sm: "divider" } },
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
