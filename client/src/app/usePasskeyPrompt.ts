import { useCallback, useState } from "react";
import { listPasskeys } from "../api/passkeys";
import { isPasskeySupported, registerPasskey } from "../auth/passkeys";
import {
  initialPasskeyPrompt,
  PASSKEY_PROMPT_DISMISSED_STORAGE_KEY,
} from "./appConstants";
import type { StatusState } from "./appTypes";

type ResolveErrorMessage = (
  error: { message?: string } | null | undefined,
) => string;
type SetStatus = (status: StatusState) => void;

function markPasskeyPromptDismissed() {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY, "true");
  }
}

function shouldSkipPasskeyPrompt() {
  return (
    typeof window !== "undefined" &&
    window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY) === "true"
  );
}

export function usePasskeyPrompt(
  resolveErrorMessage: ResolveErrorMessage,
  setStatus: SetStatus,
) {
  const [passkeyPrompt, setPasskeyPrompt] = useState(initialPasskeyPrompt);

  const closePasskeyPrompt = useCallback(() => {
    setPasskeyPrompt(initialPasskeyPrompt);
  }, []);

  const dismissPasskeyPrompt = useCallback(() => {
    markPasskeyPromptDismissed();
    closePasskeyPrompt();
  }, [closePasskeyPrompt]);

  const maybeShowPasskeyPrompt = useCallback(async () => {
    if (!isPasskeySupported() || shouldSkipPasskeyPrompt()) {
      return;
    }

    try {
      const response = (await listPasskeys()) as { passkeys?: unknown[] };
      if (Array.isArray(response.passkeys) && response.passkeys.length === 0) {
        setPasskeyPrompt({ open: true, loading: false });
      }
    } catch {
      // Prompting for passkeys is opportunistic; login should not fail if this read fails.
    }
  }, []);

  const handleAddPasskeyFromPrompt = useCallback(async () => {
    setPasskeyPrompt({ open: true, loading: true });
    try {
      await registerPasskey();
      markPasskeyPromptDismissed();
      setPasskeyPrompt(initialPasskeyPrompt);
      setStatus({
        loading: false,
        error: "",
        infoKey: "passkeys.added",
        infoParams: null,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message === "passkey_cancelled"
          ? ""
          : resolveErrorMessage(error);
      setPasskeyPrompt({ open: Boolean(message), loading: false });
      if (message) {
        setStatus({
          loading: false,
          error: message,
          infoKey: "",
          infoParams: null,
        });
      }
    }
  }, [resolveErrorMessage, setStatus]);

  return {
    dismissPasskeyPrompt,
    handleAddPasskeyFromPrompt,
    maybeShowPasskeyPrompt,
    passkeyPrompt,
  };
}
