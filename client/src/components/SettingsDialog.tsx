import { useEffect, useMemo, useState } from "react";
import type { ReactElement } from "react";
import { deletePasskey, listPasskeys } from "../api/passkeys";
import { registerPasskey } from "../auth/passkeys";
import { useI18n } from "../i18n/useI18n";
import {
  normalizeSettingsDraft,
  type PasskeyMetadata,
  type SettingsDialogProps,
  type SettingsDraft,
  type SettingsProfile,
  type SettingsSavePayload,
  type SettingsSection,
} from "./settingsDialogModel";
import { SettingsDialogFrame } from "./SettingsDialogSections";

type Translate = (key: string) => string;

function useSettingsDraftState({
  open,
  settings,
  onClose,
  onSave,
  t,
}: SettingsDialogProps & { t: Translate }) {
  const initialDraft = useMemo(
    () => normalizeSettingsDraft(settings, settings?.email),
    [settings],
  );
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("general");
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

  const handleDraftChange = <Key extends keyof SettingsDraft>(
    key: Key,
    value: SettingsDraft[Key],
  ) => {
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
        image_llm: draft.imageLlm,
      });
      onClose();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : t("errors.generic"),
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    activeSection,
    draft,
    isSaving,
    error,
    hasChanges,
    setActiveSection,
    setError,
    handleDraftChange,
    handleClose,
    handleSave,
  };
}

function useSettingsPasskeys({
  open,
  setError,
  t,
}: {
  open: boolean;
  setError: (error: string) => void;
  t: Translate;
}) {
  const [passkeys, setPasskeys] = useState<PasskeyMetadata[]>([]);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [passkeyToDelete, setPasskeyToDelete] =
    useState<PasskeyMetadata | null>(null);

  usePasskeyListLoader({ open, setIsPasskeyLoading, setPasskeys });

  const refreshPasskeys = async () => {
    const response = await listPasskeys();
    setPasskeys(normalizePasskeys(response));
  };

  const handleAddPasskey = async () => {
    setIsPasskeyLoading(true);
    setError("");
    try {
      await registerPasskey();
      await refreshPasskeys();
      setError("");
    } catch (passkeyError) {
      if (
        passkeyError instanceof Error &&
        passkeyError.message === "passkey_cancelled"
      ) {
        return;
      }
      setError(
        passkeyError instanceof Error &&
          passkeyError.message === "passkey_not_supported"
          ? t("errors.passkeyNotSupported")
          : t("errors.passkeySetupFailed"),
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
      setPasskeys((current) =>
        current.filter((passkey) => passkey.id !== passkeyToDelete.id),
      );
      setPasskeyToDelete(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t("errors.generic"),
      );
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const closePasskeyDelete = () => {
    if (!isPasskeyLoading) {
      setPasskeyToDelete(null);
    }
  };

  return {
    passkeys,
    isPasskeyLoading,
    passkeyToDelete,
    setPasskeyToDelete,
    handleAddPasskey,
    handleDeletePasskey,
    closePasskeyDelete,
  };
}

function normalizePasskeys(response: { passkeys?: unknown }) {
  return Array.isArray(response.passkeys)
    ? (response.passkeys as PasskeyMetadata[])
    : [];
}

function usePasskeyListLoader({
  open,
  setIsPasskeyLoading,
  setPasskeys,
}: {
  open: boolean;
  setIsPasskeyLoading: (isLoading: boolean) => void;
  setPasskeys: (passkeys: PasskeyMetadata[]) => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }

    let isActive = true;
    setIsPasskeyLoading(true);
    listPasskeys()
      .then((response) => {
        if (isActive) setPasskeys(normalizePasskeys(response));
      })
      .catch(() => {
        if (isActive) setPasskeys([]);
      })
      .finally(() => {
        if (isActive) setIsPasskeyLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [open, setIsPasskeyLoading, setPasskeys]);
}

function SettingsDialog({
  open,
  settings,
  onClose,
  onSave,
}: SettingsDialogProps): ReactElement {
  const { locale, t } = useI18n();
  const draftState = useSettingsDraftState({
    open,
    settings,
    onClose,
    onSave,
    t,
  });
  const passkeyState = useSettingsPasskeys({
    open,
    setError: draftState.setError,
    t,
  });

  return (
    <SettingsDialogFrame
      open={open}
      activeSection={draftState.activeSection}
      draft={draftState.draft}
      passkeys={passkeyState.passkeys}
      locale={locale}
      isSaving={draftState.isSaving}
      isPasskeyLoading={passkeyState.isPasskeyLoading}
      hasChanges={draftState.hasChanges}
      error={draftState.error}
      passkeyToDelete={passkeyState.passkeyToDelete}
      onClose={draftState.handleClose}
      onSave={() => {
        void draftState.handleSave();
      }}
      onSelectSection={draftState.setActiveSection}
      onDraftChange={draftState.handleDraftChange}
      onAddPasskey={() => {
        void passkeyState.handleAddPasskey();
      }}
      onRequestDelete={passkeyState.setPasskeyToDelete}
      onClosePasskeyDelete={passkeyState.closePasskeyDelete}
      onConfirmPasskeyDelete={() => {
        void passkeyState.handleDeletePasskey();
      }}
      t={t}
    />
  );
}

export type { SettingsProfile, SettingsSavePayload };
export default SettingsDialog;
