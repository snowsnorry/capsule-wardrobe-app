import {
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import {
  SETTINGS_FIELD_IDS,
  SettingsSelectField,
} from "./SettingsDialogFields";
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
import { SettingsPasskeySectionHeader } from "./SettingsPasskeySectionHeader";
import { SettingsRemoveAccountSection } from "./SettingsRemoveAccountSection";

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
      <SettingsSelectField
        id={SETTINGS_FIELD_IDS.theme}
        labelId={SETTINGS_FIELD_IDS.themeLabel}
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
      </SettingsSelectField>
      <SettingsSelectField
        id={SETTINGS_FIELD_IDS.language}
        labelId={SETTINGS_FIELD_IDS.languageLabel}
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
      </SettingsSelectField>
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
  const hasHiddenCurrentLlm = !PROFILE_LLM_OPTIONS.includes(draft.llm);

  return (
    <Stack spacing={2.5}>
      <SettingsSelectField
        id={SETTINGS_FIELD_IDS.stylistModel}
        labelId={SETTINGS_FIELD_IDS.stylistModelLabel}
        label={t("settings.fields.stylistModel")}
        value={draft.llm}
        onChange={(event) =>
          onDraftChange("llm", normalizeLlmValue(event.target.value))
        }
      >
        {hasHiddenCurrentLlm ? (
          <MenuItem value={draft.llm} sx={{ display: "none" }}>
            {t(`settings.llmOptions.${draft.llm}`)}
          </MenuItem>
        ) : null}
        {PROFILE_LLM_OPTIONS.map((value) => (
          <MenuItem key={value} value={value}>
            {t(`settings.llmOptions.${value}`)}
          </MenuItem>
        ))}
      </SettingsSelectField>
      <SettingsSelectField
        id={SETTINGS_FIELD_IDS.imageLlm}
        labelId={SETTINGS_FIELD_IDS.imageLlmLabel}
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
      </SettingsSelectField>
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
            spacing={2}
            sx={{
              alignItems: "center",
              justifyContent: "space-between",
              minWidth: 0,
              py: 1.5,
            }}
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
  maxHeight: 200,
  overflowY: "auto",
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
  isRemoveAccountDisabled,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  onRequestRemoveAccount,
  t,
}: {
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  isRemoveAccountDisabled: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onRequestRemoveAccount: () => void;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5}>
      <TextField
        id={SETTINGS_FIELD_IDS.fullname}
        label={t("settings.fields.name")}
        value={draft.fullname}
        onChange={(event) => onDraftChange("fullname", event.target.value)}
      />
      <TextField
        id={SETTINGS_FIELD_IDS.email}
        label={t("settings.fields.email")}
        value={draft.email}
        slotProps={{ input: { readOnly: true } }}
      />
      <Divider />
      <Stack spacing={1.5}>
        <SettingsPasskeySectionHeader
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
      {passkeys.length === 0 ? <Divider /> : null}
      <SettingsRemoveAccountSection
        isDisabled={isRemoveAccountDisabled}
        onRequestRemoveAccount={onRequestRemoveAccount}
        t={t}
      />
    </Stack>
  );
}

function SettingsSectionContent({
  activeSection,
  draft,
  passkeys,
  locale,
  isPasskeyLoading,
  isRemoveAccountDisabled,
  onDraftChange,
  onAddPasskey,
  onRequestDelete,
  onRequestRemoveAccount,
  t,
}: {
  activeSection: SettingsSection;
  draft: SettingsDraft;
  passkeys: PasskeyMetadata[];
  locale: string;
  isPasskeyLoading: boolean;
  isRemoveAccountDisabled: boolean;
  onDraftChange: <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => void;
  onAddPasskey: () => void;
  onRequestDelete: (passkey: PasskeyMetadata) => void;
  onRequestRemoveAccount: () => void;
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
      isRemoveAccountDisabled={isRemoveAccountDisabled}
      onDraftChange={onDraftChange}
      onAddPasskey={onAddPasskey}
      onRequestDelete={onRequestDelete}
      onRequestRemoveAccount={onRequestRemoveAccount}
      t={t}
    />
  );
}

export { SettingsSectionContent };
