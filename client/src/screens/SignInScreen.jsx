import { useEffect, useRef } from "react";
import { Button, Divider, Link, Stack, TextField, Typography } from "@mui/material";
import LocaleSwitcher from "../components/LocaleSwitcher.jsx";
import { useI18n } from "../i18n/useI18n.js";

const GOOGLE_GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

function ensureGoogleScriptLoaded() {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GOOGLE_GSI_SCRIPT_SRC}"]`);
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
  onResetEmail
}) {
  const { t, locale } = useI18n();
  const googleLocale = ["en", "ru"].includes(locale) ? locale : "en";
  const googleButtonRef = useRef(null);
  const googleCredentialHandlerRef = useRef(onGoogleCredential);

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

      if (isCancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const credential = String(response?.credential || "").trim();
          if (credential) {
            googleCredentialHandlerRef.current?.(credential);
          }
        }
      });

      googleButtonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        locale: googleLocale
      });
    };

    initGoogleButton();

    return () => {
      isCancelled = true;
    };
  }, [step, googleClientId, locale]);

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h4">{t("auth.signInTitle")}</Typography>
          <LocaleSwitcher />
        </Stack>
        {step === "code" ? (
          <Typography variant="body2" color="text.secondary">
            {t("auth.signInSubtitleCode")}
          </Typography>
        ) : null}
      </Stack>

      <Divider />

      {step === "email" ? (
        <Stack component="form" spacing={2} onSubmit={onRequestCode}>
          {googleClientId ? (
            <>
              <Stack alignItems="center">
                <div ref={googleButtonRef} />
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {t("auth.orEmailCode")}
              </Typography>
            </>
          ) : null}
          <TextField
            label={t("auth.emailLabel")}
            type="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            fullWidth
          />
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={status.loading || !email.trim()}
          >
            {t("auth.sendCode")}
          </Button>
        </Stack>
      ) : (
        <Stack component="form" spacing={2} onSubmit={onVerifyCode}>
          <TextField
            label={t("auth.emailCodeLabel")}
            value={code}
            onChange={(event) => onCodeChange(event.target.value)}
            placeholder={t("auth.emailCodePlaceholder")}
            type="tel"
            inputMode="numeric"
            inputProps={{ maxLength: 6 }}
            required
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={status.loading || !code.trim()}
            >
              {t("auth.verify")}
            </Button>
            <Button
              type="button"
              variant="outlined"
              size="large"
              onClick={onRequestCode}
              disabled={status.loading}
            >
              {t("auth.resendCode")}
            </Button>
          </Stack>
          <Button type="button" onClick={onResetEmail} color="secondary">
            {t("auth.changeEmail")}
          </Button>
        </Stack>
      )}

      {status.error ? (
        <Typography variant="body2" color="error">
          {status.error}
        </Typography>
      ) : null}
      {status.infoKey ? (
        <Typography variant="body2" color="text.secondary">
          {t(status.infoKey, status.infoParams || undefined)}
        </Typography>
      ) : null}

      <Divider />

      <Typography variant="caption" color="text.secondary">
        {t("auth.tosNotice")}
        <Link href="#">{` ${t("auth.learnMore")}`}</Link>
      </Typography>
    </Stack>
  );
}

export default SignInScreen;
