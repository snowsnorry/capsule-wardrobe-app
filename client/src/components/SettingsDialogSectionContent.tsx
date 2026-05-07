import {
  Button,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import {
  LANGUAGE_OPTIONS,
  PROFILE_IMAGE_LLM_OPTIONS,
  PROFILE_LLM_OPTIONS,
  PROFILE_THEME_OPTIONS,
  formatPasskeyCreatedAt,
  normalizeImageLlmValue,
  normalizeLlmValue,
  normalizeLocaleValue,
  normalizeThemeValue,
  type PasskeyMetadata,
  type SettingsDraft,
  type SettingsSection,
} from "./settingsDialogModel";

type Translate = (key: string, params?: unknown) => string;

function GeneralSettingsSection({
  draft,
  onDraftChange,
  t,
}: {
  draft: SettingsDraft;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        select
        label={t("settings.fields.theme")}
        value={draft.theme}
        onChange={(event) =>
          onDraftChange("theme", normalizeThemeValue(event.target.value))
        }
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
        onChange={(event) =>
          onDraftChange("locale", normalizeLocaleValue(event.target.value))
        }
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

function AiSettingsSection({
  draft,
  onDraftChange,
  t,
}: {
  draft: SettingsDraft;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        select
        label={t("settings.fields.stylistModel")}
        value={draft.llm}
        onChange={(event) =>
          onDraftChange("llm", normalizeLlmValue(event.target.value))
        }
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
        onChange={(event) =>
          onDraftChange("imageLlm", normalizeImageLlmValue(event.target.value))
        }
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

function PasskeyList({
  passkeys,
  locale,
  isPasskeyLoading,
  onRequestDelete,
  t,
}: {
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  if (passkeys.length === 0) return null;

  return (
    <Stack divider={<Divider flexItem />} sx={passkeyListSx}>
      {passkeys.map((passkey) => {
        const createdAt = formatPasskeyCreatedAt(passkey.createdAt, locale);
        return (
          <Stack
            key={passkey.id}
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            spacing={2}
            sx={{ minWidth: 0, py: 1.5 }}
          >
            <PasskeyListText passkey={passkey} createdAt={createdAt} t={t} />
            <IconButton
              aria-label={t("passkeys.remove")}
              onClick={() => onRequestDelete(passkey)}
              disabled={isPasskeyLoading}
              sx={{ flexShrink: 0 }}
            >
              <DeleteOutlineRoundedIcon />
            </IconButton>
          </Stack>
        );
      })}
    </Stack>
  );
}

const passkeyListSx = {
  borderTop: "1px solid",
  borderBottom: "1px solid",
  borderColor: "divider",
} as const;

function PasskeyListText({
  createdAt,
  passkey,
  t,
}: {
  createdAt: ReturnType<typeof formatPasskeyCreatedAt>;
  passkey: PasskeyMetadata;
  t: Translate;
}) {
  return (
    <Stack
      spacing={0.5}
      sx={{ flex: "1 1 auto", minWidth: 0, overflow: "hidden" }}
    >
      <Typography noWrap>
        {passkey.name || t("passkeys.defaultName")}
      </Typography>
      {createdAt ? (
        <Typography variant="body2" color="text.secondary" noWrap>
          {t("passkeys.createdOn", createdAt)}
        </Typography>
      ) : null}
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
  t,
}: {
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        label={t("settings.fields.name")}
        value={draft.fullname}
        onChange={(event) => onDraftChange("fullname", event.target.value)}
      />
      <TextField
        label={t("settings.fields.email")}
        value={draft.email}
        InputProps={{ readOnly: true }}
      />
      <Divider />
      <Stack spacing={1.5}>
        <PasskeySectionHeader
          isPasskeyLoading={isPasskeyLoading}
          onAddPasskey={onAddPasskey}
          t={t}
        />
        {isPasskeyLoading ? (
          <LinearProgress aria-label={t("passkeys.loading")} />
        ) : null}
        {!isPasskeyLoading && passkeys.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {t("passkeys.empty")}
          </Typography>
        ) : null}
        <PasskeyList
          passkeys={passkeys}
          locale={locale}
          isPasskeyLoading={isPasskeyLoading}
          onRequestDelete={onRequestDelete}
          t={t}
        />
      </Stack>
    </Stack>
  );
}

function PasskeySectionHeader({
  isPasskeyLoading,
  onAddPasskey,
  t,
}: {
  isPasskeyLoading: boolean;
  onAddPasskey: () => void;
  t: Translate;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
    >
      <Typography variant="subtitle1" fontWeight={700}>
        {t("passkeys.title")}
      </Typography>
      <Button
        type="button"
        variant="outlined"
        size="small"
        startIcon={<KeyRoundedIcon />}
        onClick={onAddPasskey}
        disabled={isPasskeyLoading}
      >
        {t("passkeys.add")}
      </Button>
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
  t,
}: {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  t: Translate;
}) {
  if (activeSection === "general") {
    return (
      <GeneralSettingsSection
        draft={draft}
        onDraftChange={onDraftChange}
        t={t}
      />
    );
  }
  if (activeSection === "ai") {
    return (
      <AiSettingsSection draft={draft} onDraftChange={onDraftChange} t={t} />
    );
  }
  return (
    <AccountSettingsSection
      draft={draft}
      passkeys={passkeys}
      locale={locale}
      isPasskeyLoading={isPasskeyLoading}
      onDraftChange={onDraftChange}
      onAddPasskey={onAddPasskey}
      onRequestDelete={onRequestDelete}
      t={t}
    />
  );
}

export { SettingsSectionContent };
