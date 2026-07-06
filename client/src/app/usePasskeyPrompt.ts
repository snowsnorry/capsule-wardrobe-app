import { useCallback, useState } from "react";
import { listPasskeys } from "../api/passkeys";
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
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY, "true");
  } catch {
    // Prompt dismissal persistence is optional; keep the current UI flow.
  }
}

function shouldSkipPasskeyPrompt() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    return (
      window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY) ===
      "true"
    );
  } catch {
    return false;
  }
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
    if (shouldSkipPasskeyPrompt()) {
      return;
    }

    try {
      const { isPasskeySupported } = await import("../auth/passkeys");
      if (!isPasskeySupported()) {
        return;
      }
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
      const { registerPasskey } = await import("../auth/passkeys");
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
