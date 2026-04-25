import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import DeleteRoundedIcon from "@mui/icons-material/DeleteRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import type { ReactElement } from "react";
import { deletePasskey, listPasskeys } from "../api/passkeys";
import { registerPasskey } from "../auth/passkeys";
import { useI18n } from "../i18n/useI18n";
import { PROFILE_IMAGE_LLM_VALUES, PROFILE_LLM_VALUES, PROFILE_THEME_VALUES } from "../../../shared/profileSettings.js";

const SETTINGS_SECTIONS = ["general", "ai", "account"] as const;
const LANGUAGE_OPTIONS = ["en", "ru"] as const;
const PROFILE_THEME_OPTIONS = [...PROFILE_THEME_VALUES];
const PROFILE_LLM_OPTIONS = [...PROFILE_LLM_VALUES];
const PROFILE_IMAGE_LLM_OPTIONS = [...PROFILE_IMAGE_LLM_VALUES];

type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
type SettingsLocale = (typeof LANGUAGE_OPTIONS)[number];
type SettingsTheme = (typeof PROFILE_THEME_VALUES)[number];
type SettingsLlm = (typeof PROFILE_LLM_VALUES)[number];
type SettingsImageLlm = (typeof PROFILE_IMAGE_LLM_VALUES)[number];

type SettingsProfile = {
  fullname?: string | null;
  email?: string | null;
  locale?: string | null;
  theme?: string | null;
  llm?: string | null;
  imageLlm?: string | null;
  image_llm?: string | null;
};

type SettingsDraft = {
  fullname: string;
  email: string;
  locale: SettingsLocale;
  theme: SettingsTheme;
  llm: SettingsLlm;
  imageLlm: SettingsImageLlm;
};

type SettingsSavePayload = {
  fullname: string;
  locale: SettingsLocale;
  theme: SettingsTheme;
  llm: SettingsLlm;
  image_llm: SettingsImageLlm;
};

type PasskeyMetadata = {
  id: string;
  name?: string | null;
  deviceType?: string | null;
  backedUp?: boolean | null;
  transports?: string[] | null;
  createdAt?: string | null;
  lastUsedAt?: string | null;
};

type SettingsDialogProps = {
  open: boolean;
  settings: SettingsProfile;
  onClose: () => void;
  onSave: (settings: SettingsSavePayload) => Promise<void> | void;
};

function isOneOf<T extends string>(options: readonly T[], value: string | null | undefined): value is T {
  return typeof value === "string" && options.some((option) => option === value);
}

function normalizeLocaleValue(value: string): SettingsLocale {
  return isOneOf(LANGUAGE_OPTIONS, value) ? value : "en";
}

function normalizeThemeValue(value: string): SettingsTheme {
  return isOneOf(PROFILE_THEME_OPTIONS, value) ? value : "system";
}

function normalizeLlmValue(value: string): SettingsLlm {
  return isOneOf(PROFILE_LLM_OPTIONS, value) ? value : "openai:gpt-5.5";
}

function normalizeImageLlmValue(value: string): SettingsImageLlm {
  return isOneOf(PROFILE_IMAGE_LLM_OPTIONS, value) ? value : "openai:gpt-image-2";
}

function normalizeSettingsDraft(settings: SettingsProfile = {}, fallbackEmail = ""): SettingsDraft {
  return {
    fullname: typeof settings.fullname === "string" ? settings.fullname : "",
    email: String(settings.email || fallbackEmail || "").trim(),
    locale: isOneOf(LANGUAGE_OPTIONS, settings.locale) ? settings.locale : "en",
    theme: normalizeThemeValue(String(settings.theme || "")),
    llm: normalizeLlmValue(String(settings.llm || "")),
    imageLlm: normalizeImageLlmValue(String(settings.imageLlm || settings.image_llm || ""))
  };
}

function SettingsDialog({
  open,
  settings,
  onClose,
  onSave
}: SettingsDialogProps): ReactElement {
  const { t } = useI18n();
  const initialDraft = useMemo(
    () => normalizeSettingsDraft(settings, settings?.email),
    [settings]
  );
  const [activeSection, setActiveSection] = useState<SettingsSection>("general");
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [passkeys, setPasskeys] = useState<PasskeyMetadata[]>([]);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [passkeyToDelete, setPasskeyToDelete] = useState<PasskeyMetadata | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveSection("general");
    setDraft(initialDraft);
    setError("");
    setIsSaving(false);
  }, [initialDraft, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;
    setIsPasskeyLoading(true);
    listPasskeys()
      .then((response) => {
        if (!isActive) {
          return;
        }
        setPasskeys(Array.isArray(response.passkeys) ? response.passkeys as PasskeyMetadata[] : []);
      })
      .catch(() => {
        if (isActive) {
          setPasskeys([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsPasskeyLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [open]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const handleDraftChange = <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    setDraft(initialDraft);
    setError("");
    setActiveSection("general");
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError("");
    try {
      await onSave({
        fullname: draft.fullname,
        locale: draft.locale,
        theme: draft.theme,
        llm: draft.llm,
        image_llm: draft.imageLlm
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("errors.generic"));
    } finally {
      setIsSaving(false);
    }
  };

  const refreshPasskeys = async () => {
    const response = await listPasskeys();
    setPasskeys(Array.isArray(response.passkeys) ? response.passkeys as PasskeyMetadata[] : []);
  };

  const handleAddPasskey = async () => {
    setIsPasskeyLoading(true);
    setError("");
    try {
      await registerPasskey();
      await refreshPasskeys();
      setError("");
    } catch (passkeyError) {
      if (passkeyError instanceof Error && passkeyError.message === "passkey_cancelled") {
        return;
      }
      setError(
        passkeyError instanceof Error && passkeyError.message === "passkey_not_supported"
          ? t("errors.passkeyNotSupported")
          : t("errors.passkeySetupFailed")
      );
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleDeletePasskey = async () => {
    if (!passkeyToDelete) {
      return;
    }

    setIsPasskeyLoading(true);
    setError("");
    try {
      await deletePasskey(passkeyToDelete.id);
      setPasskeys((current) => current.filter((passkey) => passkey.id !== passkeyToDelete.id));
      setPasskeyToDelete(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("errors.generic"));
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const renderSectionContent = (): ReactElement => {
    if (activeSection === "general") {
      return (
        <Stack spacing={2.5}>
          <TextField
            select
            label={t("settings.fields.theme")}
            value={draft.theme}
            onChange={(event) => handleDraftChange("theme", normalizeThemeValue(event.target.value))}
          >
            {PROFILE_THEME_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`settings.themeOptions.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("settings.fields.language")}
            value={draft.locale}
            onChange={(event) => handleDraftChange("locale", normalizeLocaleValue(event.target.value))}
          >
            {LANGUAGE_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`locale.options.${value}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      );
    }

    if (activeSection === "ai") {
      return (
        <Stack spacing={2.5}>
          <TextField
            select
            label={t("settings.fields.stylistModel")}
            value={draft.llm}
            onChange={(event) => handleDraftChange("llm", normalizeLlmValue(event.target.value))}
          >
            {PROFILE_LLM_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`settings.llmOptions.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("settings.fields.imageGenerationModel")}
            value={draft.imageLlm}
            onChange={(event) => handleDraftChange("imageLlm", normalizeImageLlmValue(event.target.value))}
          >
            {PROFILE_IMAGE_LLM_OPTIONS.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`settings.imageLlmOptions.${value}`)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      );
    }

    return (
      <Stack spacing={2.5}>
        <TextField
          label={t("settings.fields.name")}
          value={draft.fullname}
          onChange={(event) => handleDraftChange("fullname", event.target.value)}
        />
        <TextField
          label={t("settings.fields.email")}
          value={draft.email}
          InputProps={{ readOnly: true }}
        />
        <Divider />
        <Stack spacing={1.5}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
            <Typography variant="subtitle1" fontWeight={700}>
              {t("passkeys.title")}
            </Typography>
            <Button
              type="button"
              variant="outlined"
              size="small"
              startIcon={<KeyRoundedIcon />}
              onClick={() => { void handleAddPasskey(); }}
              disabled={isPasskeyLoading}
            >
              {t("passkeys.add")}
            </Button>
          </Stack>
          {isPasskeyLoading ? <LinearProgress aria-label={t("passkeys.loading")} /> : null}
          {!isPasskeyLoading && passkeys.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              {t("passkeys.empty")}
            </Typography>
          ) : null}
          {passkeys.map((passkey) => (
            <Stack
              key={passkey.id}
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              spacing={2}
              sx={{
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                px: 1.5,
                py: 1
              }}
            >
              <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                <Typography noWrap fontWeight={600}>
                  {passkey.name || t("passkeys.defaultName")}
                </Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {passkey.deviceType ? <Chip size="small" label={passkey.deviceType} /> : null}
                  {passkey.backedUp ? <Chip size="small" label={t("passkeys.backedUp")} /> : null}
                  {passkey.lastUsedAt ? <Chip size="small" label={t("passkeys.used")} /> : null}
                </Stack>
              </Stack>
              <IconButton
                aria-label={t("passkeys.remove")}
                color="error"
                onClick={() => setPasskeyToDelete(passkey)}
                disabled={isPasskeyLoading}
              >
                <DeleteRoundedIcon />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Stack>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>{t("settings.title")}</DialogTitle>
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
              "& .MuiLinearProgress-bar": {
                borderRadius: 999
              }
            }}
          />
        ) : null}
      </Box>
      <DialogContent sx={{ pt: 1, pb: 0 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0, 1fr)" },
            gap: 3,
            minHeight: { sm: 320 }
          }}
        >
          <List sx={{ py: 0, borderRight: { sm: "1px solid", borderColor: { sm: "divider" } }, pr: { sm: 2 } }}>
            {SETTINGS_SECTIONS.map((section) => (
              <ListItemButton
                key={section}
                selected={activeSection === section}
                onClick={() => setActiveSection(section)}
                sx={{ borderRadius: 2, mb: 0.5 }}
              >
                <ListItemText primary={t(`settings.sections.${section}`)} />
              </ListItemButton>
            ))}
          </List>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              {t(`settings.sectionHints.${activeSection}`)}
            </Typography>
            {renderSectionContent()}
            {error ? (
              <Typography variant="body2" color="error">
                {error}
              </Typography>
            ) : null}
          </Stack>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button onClick={handleClose} disabled={isSaving}>
          {t("actions.cancel")}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving || !hasChanges}>
          {t("actions.save")}
        </Button>
      </DialogActions>
      <Dialog
        open={Boolean(passkeyToDelete)}
        onClose={() => {
          if (!isPasskeyLoading) {
            setPasskeyToDelete(null);
          }
        }}
      >
        <DialogTitle>{t("passkeys.remove")}</DialogTitle>
        <DialogContent>
          <DialogContentText>{t("passkeys.removeConfirm")}</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button disabled={isPasskeyLoading} onClick={() => setPasskeyToDelete(null)}>
            {t("actions.cancel")}
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={isPasskeyLoading}
            onClick={() => { void handleDeletePasskey(); }}
          >
            {t("passkeys.remove")}
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

export type { SettingsDialogProps, SettingsProfile, SettingsSavePayload };
export default SettingsDialog;
