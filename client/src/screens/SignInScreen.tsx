import { useCallback, useEffect, useRef, useState } from "react";
import {
  Divider,
  LinearProgress,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useI18n } from "../i18n/useI18n";
import {
  CodeStepForm,
  EmailStepForm,
  SignInHeader,
  SignInStatusMessages,
} from "./SignInScreenParts";
import type { SignInScreenProps } from "./SignInScreenTypes";

const GOOGLE_GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
const GOOGLE_SIGN_IN_BUTTON_MAX_WIDTH = 320;

type GoogleCredentialResponse = {
  credential?: string | null;
};

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
  }) => void;
  renderButton: (
    container: HTMLDivElement,
    options: {
      type: string;
      theme: string;
      size: string;
      width: number;
      text: string;
      locale: string;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

function ensureGoogleScriptLoaded(): Promise<void> {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_GSI_SCRIPT_SRC}"]`,
    );
    if (existing) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      const onLoad = () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
        resolve();
      };
      const onError = () => {
        existing.removeEventListener("load", onLoad);
        existing.removeEventListener("error", onError);
        reject(new Error("google_script_load_failed"));
      };
      existing.addEventListener("load", onLoad);
      existing.addEventListener("error", onError);
      window.setTimeout(() => {
        if (window.google?.accounts?.id) {
          existing.removeEventListener("load", onLoad);
          existing.removeEventListener("error", onError);
          resolve();
        }
      }, 0);
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("google_script_load_failed"));
    document.head.appendChild(script);
  });
}

function getGoogleButtonRenderWidth(container: HTMLDivElement): number {
  const { width } = container.getBoundingClientRect();
  const measuredWidth = width || container.clientWidth;

  if (!Number.isFinite(measuredWidth) || measuredWidth <= 0) {
    return GOOGLE_SIGN_IN_BUTTON_MAX_WIDTH;
  }

  return Math.min(GOOGLE_SIGN_IN_BUTTON_MAX_WIDTH, Math.floor(measuredWidth));
}

function useGoogleButtonContainer({
  step,
  googleClientId,
}: {
  step: SignInScreenProps["step"];
  googleClientId: string;
}) {
  const [googleButtonContainer, setGoogleButtonContainer] =
    useState<HTMLDivElement | null>(null);
  const [googleButtonWidth, setGoogleButtonWidth] = useState(
    GOOGLE_SIGN_IN_BUTTON_MAX_WIDTH,
  );

  const updateGoogleButtonWidth = useCallback((container: HTMLDivElement) => {
    const nextWidth = getGoogleButtonRenderWidth(container);
    setGoogleButtonWidth((currentWidth) =>
      currentWidth === nextWidth ? currentWidth : nextWidth,
    );
  }, []);

  const googleButtonRef = useCallback(
    (container: HTMLDivElement | null) => {
      setGoogleButtonContainer(container);
      if (container) {
        updateGoogleButtonWidth(container);
      }
    },
    [updateGoogleButtonWidth],
  );

  useEffect(() => {
    if (step !== "email" || !googleClientId || !googleButtonContainer) {
      return;
    }

    updateGoogleButtonWidth(googleButtonContainer);

    const onResize = () => updateGoogleButtonWidth(googleButtonContainer);

    if (typeof window.ResizeObserver === "undefined") {
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const resizeObserver = new window.ResizeObserver(onResize);
    resizeObserver.observe(googleButtonContainer);

    return () => resizeObserver.disconnect();
  }, [googleButtonContainer, googleClientId, step, updateGoogleButtonWidth]);

  return { googleButtonContainer, googleButtonRef, googleButtonWidth };
}

function useGoogleSignInButton({
  step,
  googleClientId,
  googleLocale,
  onGoogleCredential,
}: {
  step: SignInScreenProps["step"];
  googleClientId: string;
  googleLocale: string;
  onGoogleCredential: (credential: string) => void;
}) {
  const { googleButtonContainer, googleButtonRef, googleButtonWidth } =
    useGoogleButtonContainer({ step, googleClientId });
  const [initializedGoogleClientId, setInitializedGoogleClientId] = useState<
    string | null
  >(null);
  const googleCredentialHandlerRef =
    useRef<SignInScreenProps["onGoogleCredential"]>(onGoogleCredential);

  useEffect(() => {
    googleCredentialHandlerRef.current = onGoogleCredential;
  }, [onGoogleCredential]);

  useEffect(() => {
    if (step !== "email" || !googleClientId) {
      setInitializedGoogleClientId(null);
      return;
    }

    let isCancelled = false;
    setInitializedGoogleClientId(null);

    const initGoogleClient = async () => {
      try {
        await ensureGoogleScriptLoaded();
      } catch {
        return;
      }

      if (isCancelled || !window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const credential = String(response?.credential || "").trim();
          if (credential) {
            googleCredentialHandlerRef.current?.(credential);
          }
        },
      });
      setInitializedGoogleClientId(googleClientId);
    };

    initGoogleClient();

    return () => {
      isCancelled = true;
    };
  }, [step, googleClientId]);

  useEffect(() => {
    if (
      step !== "email" ||
      !googleClientId ||
      initializedGoogleClientId !== googleClientId ||
      !googleButtonContainer ||
      !window.google?.accounts?.id
    ) {
      return;
    }

    googleButtonContainer.innerHTML = "";
    window.google.accounts.id.renderButton(googleButtonContainer, {
      type: "standard",
      theme: "outline",
      size: "large",
      width: googleButtonWidth,
      text: "continue_with",
      locale: googleLocale,
    });
  }, [
    googleButtonContainer,
    googleButtonWidth,
    googleClientId,
    googleLocale,
    initializedGoogleClientId,
    step,
  ]);

  return googleButtonRef;
}

function SignInScreen({
  step,
  email,
  code,
  status,
  googleClientId,
  onEmailChange,
  onCodeChange,
  onRequestCode,
  onVerifyCode,
  onGoogleCredential,
  onPasskeySignIn,
  onResetEmail,
}: SignInScreenProps) {
  const { t, locale } = useI18n();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const googleLocale = ["en", "ru"].includes(locale) ? locale : "en";
  const googleButtonRef = useGoogleSignInButton({
    step,
    googleClientId,
    googleLocale,
    onGoogleCredential,
  });

  return (
    <Stack spacing={3}>
      <SignInHeader isMobile={isMobile} step={step} t={t} />

      <Stack spacing={0}>
        <Divider />
        {status.loading ? (
          <LinearProgress aria-label={t("auth.signInProgress")} />
        ) : null}
      </Stack>

      {step === "email" ? (
        <EmailStepForm
          email={email}
          status={status}
          googleClientId={googleClientId}
          googleButtonRef={googleButtonRef}
          onEmailChange={onEmailChange}
          onRequestCode={onRequestCode}
          onPasskeySignIn={onPasskeySignIn}
          t={t}
        />
      ) : (
        <CodeStepForm
          code={code}
          status={status}
          onCodeChange={onCodeChange}
          onRequestCode={onRequestCode}
          onVerifyCode={onVerifyCode}
          onResetEmail={onResetEmail}
          t={t}
        />
      )}

      <SignInStatusMessages status={status} t={t} />

      <Divider />

      <Typography variant="caption" color="text.secondary">
        {t("auth.tosNotice")}
        <Link href="#">{` ${t("auth.learnMore")}`}</Link>
      </Typography>
    </Stack>
  );
}

export default SignInScreen;
