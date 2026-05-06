import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import {
  LANGUAGE_OPTIONS,
  PROFILE_IMAGE_LLM_OPTIONS,
  PROFILE_LLM_OPTIONS,
  PROFILE_THEME_OPTIONS,
  SETTINGS_SECTIONS,
  formatPasskeyCreatedAt,
  normalizeImageLlmValue,
  normalizeLlmValue,
  normalizeLocaleValue,
  normalizeThemeValue,
  type PasskeyMetadata,
  type SettingsDraft,
  type SettingsSection
} from "./settingsDialogModel";

type Translate = (key: string, params?: unknown) => string;

function GeneralSettingsSection({
  draft,
  onDraftChange,
  t
}: {
  draft: SettingsDraft;
  onDraftChange: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField select label={t("settings.fields.theme")} value={draft.theme} onChange={(event) => onDraftChange("theme", normalizeThemeValue(event.target.value))}>
        {PROFILE_THEME_OPTIONS.map((value) => <MenuItem key={value} value={value}>{t(`settings.themeOptions.${value}`)}</MenuItem>)}
      </TextField>
      <TextField select label={t("settings.fields.language")} value={draft.locale} onChange={(event) => onDraftChange("locale", normalizeLocaleValue(event.target.value))}>
        {LANGUAGE_OPTIONS.map((value) => <MenuItem key={value} value={value}>{t(`locale.options.${value}`)}</MenuItem>)}
      </TextField>
    </Stack>
  );
}

function AiSettingsSection({
  draft,
  onDraftChange,
  t
}: {
  draft: SettingsDraft;
  onDraftChange: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField select label={t("settings.fields.stylistModel")} value={draft.llm} onChange={(event) => onDraftChange("llm", normalizeLlmValue(event.target.value))}>
        {PROFILE_LLM_OPTIONS.map((value) => <MenuItem key={value} value={value}>{t(`settings.llmOptions.${value}`)}</MenuItem>)}
      </TextField>
      <TextField select label={t("settings.fields.imageGenerationModel")} value={draft.imageLlm} onChange={(event) => onDraftChange("imageLlm", normalizeImageLlmValue(event.target.value))}>
        {PROFILE_IMAGE_LLM_OPTIONS.map((value) => <MenuItem key={value} value={value}>{t(`settings.imageLlmOptions.${value}`)}</MenuItem>)}
      </TextField>
    </Stack>
  );
}

function PasskeyList({
  passkeys,
  locale,
  isPasskeyLoading,
  onRequestDelete,
  t
}: {
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  if (passkeys.length === 0) {
    return null;
  }

  return (
    <Stack divider={<Divider flexItem />} sx={{ borderTop: "1px solid", borderBottom: "1px solid", borderColor: "divider" }}>
      {passkeys.map((passkey) => {
        const createdAt = formatPasskeyCreatedAt(passkey.createdAt, locale);
        return (
          <Stack key={passkey.id} direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ minWidth: 0, py: 1.5 }}>
            <Stack spacing={0.5} sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}>
              <Typography noWrap>{passkey.name || t("passkeys.defaultName")}</Typography>
              {createdAt ? <Typography variant="body2" color="text.secondary" noWrap>{t("passkeys.createdOn", createdAt)}</Typography> : null}
            </Stack>
            <IconButton aria-label={t("passkeys.remove")} onClick={() => onRequestDelete(passkey)} disabled={isPasskeyLoading} sx={{ flexShrink: 0 }}>
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </Stack>
        );
      })}
    </Stack>
  );
}

function AccountSettingsSection({
  draft,
  passkeys,
  locale,
  isPasskeyLoading,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  t
}: {
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField label={t("settings.fields.name")} value={draft.fullname} onChange={(event) => onDraftChange("fullname", event.target.value)} />
      <TextField label={t("settings.fields.email")} value={draft.email} InputProps={{ readOnly: true }} />
      <Divider />
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
          <Typography variant="subtitle1" fontWeight={700}>{t("passkeys.title")}</Typography>
          <Button type="button" variant="outlined" size="small" startIcon={<KeyRoundedIcon />} onClick={onAddPasskey} disabled={isPasskeyLoading}>{t("passkeys.add")}</Button>
        </Stack>
        {isPasskeyLoading ? <LinearProgress aria-label={t("passkeys.loading")} /> : null}
        {!isPasskeyLoading && passkeys.length === 0 ? <Typography variant="body2" color="text.secondary">{t("passkeys.empty")}</Typography> : null}
        <PasskeyList passkeys={passkeys} locale={locale} isPasskeyLoading={isPasskeyLoading} onRequestDelete={onRequestDelete} t={t} />
      </Stack>
    </Stack>
  );
}

function SettingsSectionContent({
  activeSection,
  draft,
  passkeys,
  locale,
  isPasskeyLoading,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  t
}: {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  if (activeSection === "general") {
    return <GeneralSettingsSection draft={draft} onDraftChange={onDraftChange} t={t} />;
  }
  if (activeSection === "ai") {
    return <AiSettingsSection draft={draft} onDraftChange={onDraftChange} t={t} />;
  }
  return <AccountSettingsSection draft={draft} passkeys={passkeys} locale={locale} isPasskeyLoading={isPasskeyLoading} onDraftChange={onDraftChange} onAddPasskey={onAddPasskey} onRequestDelete={onRequestDelete} t={t} />;
}

function PasskeyDeleteDialog({
  passkeyToDelete,
  isPasskeyLoading,
  onClose,
  onConfirm,
  t
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
      <DialogContent><DialogContentText>{t("passkeys.removeConfirm")}</DialogContentText></DialogContent>
      <DialogActions>
        <Button disabled={isPasskeyLoading} onClick={onClose}>{t("actions.cancel")}</Button>
        <Button color="error" variant="contained" disabled={isPasskeyLoading} onClick={onConfirm}>{t("passkeys.remove")}</Button>
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
  t
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
  onDraftChange: <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onClosePasskeyDelete: () => void;
  onConfirmPasskeyDelete: () => void;
  t: Translate;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{t("settings.title")}</DialogTitle>
      <Box sx={{ px: 3, pb: 0.5 }}>
        <Divider sx={{ borderColor: "divider" }} />
        {isSaving ? <LinearProgress color="success" sx={{ mt: "-2px", height: 3, borderRadius: 999, backgroundColor: "action.hover", "& .MuiLinearProgress-bar": { borderRadius: 999 } }} /> : null}
      </Box>
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0, 1fr)" }, gap: 3, minHeight: { sm: 320 } }}>
          <List sx={{ py: 0, borderRight: { sm: "1px solid", borderColor: { sm: "divider" } }, pr: { sm: 2 } }}>
            {SETTINGS_SECTIONS.map((section) => (
              <ListItemButton key={section} selected={activeSection === section} onClick={() => onSelectSection(section)} sx={{ borderRadius: 2, mb: 0.5 }}>
                <ListItemText primary={t(`settings.sections.${section}`)} />
              </ListItemButton>
            ))}
          </List>
          <Stack spacing={2} sx={{ minWidth: 0 }}>
            <Typography variant="body2" color="text.secondary">{t(`settings.sectionHints.${activeSection}`)}</Typography>
            <SettingsSectionContent activeSection={activeSection} draft={draft} passkeys={passkeys} locale={locale} isPasskeyLoading={isPasskeyLoading} onDraftChange={onDraftChange} onAddPasskey={onAddPasskey} onRequestDelete={onRequestDelete} t={t} />
            {error ? <Typography variant="body2" color="error">{error}</Typography> : null}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button onClick={onClose} disabled={isSaving}>{t("actions.cancel")}</Button>
        <Button variant="contained" onClick={onSave} disabled={isSaving || !hasChanges}>{t("actions.save")}</Button>
      </DialogActions>
      <PasskeyDeleteDialog passkeyToDelete={passkeyToDelete} isPasskeyLoading={isPasskeyLoading} onClose={onClosePasskeyDelete} onConfirm={onConfirmPasskeyDelete} t={t} />
    </Dialog>
  );
}

export { SettingsDialogFrame };
