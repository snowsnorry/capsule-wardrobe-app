import { useEffect, useRef } from "react";
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
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleCredentialHandlerRef =
    useRef<SignInScreenProps["onGoogleCredential"]>(onGoogleCredential);

  useEffect(() => {
    googleCredentialHandlerRef.current = onGoogleCredential;
  }, [onGoogleCredential]);

  useEffect(() => {
    if (step !== "email" || !googleClientId || !googleButtonRef.current) {
      return;
    }

    let isCancelled = false;
    const initGoogleButton = async () => {
      try {
        await ensureGoogleScriptLoaded();
      } catch {
        return;
      }

      if (
        isCancelled ||
        !googleButtonRef.current ||
        !window.google?.accounts?.id
      ) {
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

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        locale: googleLocale,
      });
    };

    initGoogleButton();

    return () => {
      isCancelled = true;
    };
  }, [step, googleClientId, googleLocale]);

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

export type { SignInScreenProps, SignInStatus } from "./SignInScreenTypes";
export default SignInScreen;
