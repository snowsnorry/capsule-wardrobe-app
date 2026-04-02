import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";
import { PROFILE_LLM_VALUES, PROFILE_THEME_VALUES } from "../../../shared/profileSettings.js";

const SETTINGS_SECTIONS = ["general", "ai", "account"];
const LANGUAGE_OPTIONS = ["en", "ru"];

function normalizeSettingsDraft(settings = {}, fallbackEmail = "") {
  return {
    fullname: typeof settings.fullname === "string" ? settings.fullname : "",
    email: String(settings.email || fallbackEmail || "").trim(),
    locale: LANGUAGE_OPTIONS.includes(settings.locale) ? settings.locale : "en",
    theme: PROFILE_THEME_VALUES.includes(settings.theme) ? settings.theme : "system",
    llm: PROFILE_LLM_VALUES.includes(settings.llm) ? settings.llm : "openai:gpt-5.2"
  };
}

function SettingsDialog({
  open,
  settings,
  onClose,
  onSave
}) {
  const { t } = useI18n();
  const initialDraft = useMemo(
    () => normalizeSettingsDraft(settings, settings?.email),
    [settings]
  );
  const [activeSection, setActiveSection] = useState("general");
  const [draft, setDraft] = useState(initialDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    setActiveSection("general");
    setDraft(initialDraft);
    setError("");
    setIsSaving(false);
  }, [initialDraft, open]);

  const hasChanges = JSON.stringify(draft) !== JSON.stringify(initialDraft);

  const handleDraftChange = (key, value) => {
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
        llm: draft.llm
      });
      onClose();
    } catch (saveError) {
      setError(saveError?.message || t("errors.generic"));
    } finally {
      setIsSaving(false);
    }
  };

  const renderSectionContent = () => {
    if (activeSection === "general") {
      return (
        <Stack spacing={2.5}>
          <TextField
            select
            label={t("settings.fields.theme")}
            value={draft.theme}
            onChange={(event) => handleDraftChange("theme", event.target.value)}
          >
            {PROFILE_THEME_VALUES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`settings.themeOptions.${value}`)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label={t("settings.fields.language")}
            value={draft.locale}
            onChange={(event) => handleDraftChange("locale", event.target.value)}
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
            onChange={(event) => handleDraftChange("llm", event.target.value)}
          >
            {PROFILE_LLM_VALUES.map((value) => (
              <MenuItem key={value} value={value}>
                {t(`settings.llmOptions.${value}`)}
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
    </Dialog>
  );
}

export default SettingsDialog;
