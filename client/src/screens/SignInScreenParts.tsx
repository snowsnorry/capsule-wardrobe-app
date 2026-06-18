import type { ChangeEvent, Ref } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import KeyRoundedIcon from "@mui/icons-material/KeyRounded";
import LocaleSwitcher from "../components/LocaleSwitcher";
import type { SignInScreenProps, SignInStatus } from "./SignInScreenTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

function SignInHeader({
  isMobile,
  step,
  t,
}: {
  isMobile: boolean;
  step: SignInScreenProps["step"];
  t: Translate;
}) {
  const headerSpacing = isMobile ? 2 : undefined;

  return (
    <Stack spacing={1}>
      <Stack
        direction="row"
        spacing={headerSpacing}
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography
          sx={{
            fontFamily: "var(--cw-font-family-wordmark)",
            fontSize: "var(--cw-font-size-wordmark-sign-in)",
            lineHeight: 1.1,
            color: "secondary.main",
            textAlign: "left",
          }}
        >
          {t("appName")}
        </Typography>
        <LocaleSwitcher />
      </Stack>
      {step === "code" ? (
        <Typography variant="body2" color="text.secondary">
          {t("auth.signInSubtitleCode")}
        </Typography>
      ) : null}
    </Stack>
  );
}

function PasskeySignInButton({
  loading,
  onPasskeySignIn,
  t,
}: {
  loading: boolean;
  onPasskeySignIn: () => void;
  t: Translate;
}) {
  return (
    <Stack sx={{ alignItems: "center" }}>
      <Button
        type="button"
        variant="outlined"
        startIcon={<KeyRoundedIcon />}
        onClick={onPasskeySignIn}
        disabled={loading}
        sx={{
          width: "min(320px, 100%)",
          height: "var(--cw-control-action-height)",
          position: "relative",
          justifyContent: "center",
          borderRadius: "var(--cw-radius-control)",
          borderColor: "divider",
          backgroundColor: "background.paper",
          color: "text.primary",
          paddingLeft: "38px",
          "&:hover": {
            borderColor: "primary.main",
            backgroundColor: "var(--cw-color-passkey-hover-bg)",
          },
          "& .MuiButton-startIcon": {
            position: "absolute",
            left: 12,
            m: 0,
            color: "primary.main",
          },
          "& .MuiSvgIcon-root": { fontSize: 20 },
        }}
      >
        {t("auth.signInWithPasskey")}
      </Button>
    </Stack>
  );
}

function EmailStepForm({
  email,
  status,
  googleClientId,
  googleButtonRef,
  onEmailChange,
  onRequestCode,
  onPasskeySignIn,
  t,
}: {
  email: string;
  status: SignInStatus;
  googleClientId: string;
  googleButtonRef: Ref<HTMLDivElement>;
  onEmailChange: (nextEmail: string) => void;
  onRequestCode: SignInScreenProps["onRequestCode"];
  onPasskeySignIn: () => void;
  t: Translate;
}) {
  return (
    <Stack component="form" spacing={2} onSubmit={onRequestCode}>
      <PasskeySignInButton
        loading={status.loading}
        onPasskeySignIn={onPasskeySignIn}
        t={t}
      />
      {googleClientId ? (
        <>
          <Stack sx={{ alignItems: "center" }}>
            <Box
              ref={googleButtonRef}
              sx={{
                width: "min(320px, 100%)",
                maxWidth: "100%",
                minWidth: 0,
                display: "flex",
                justifyContent: "center",
                "& iframe": {
                  maxWidth: "100%",
                },
              }}
            />
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
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onEmailChange(event.target.value)
        }
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
  );
}

function CodeStepForm({
  code,
  status,
  onCodeChange,
  onRequestCode,
  onVerifyCode,
  onResetEmail,
  t,
}: {
  code: string;
  status: SignInStatus;
  onCodeChange: (nextCode: string) => void;
  onRequestCode: SignInScreenProps["onRequestCode"];
  onVerifyCode: SignInScreenProps["onVerifyCode"];
  onResetEmail: () => void;
  t: Translate;
}) {
  return (
    <Stack component="form" spacing={2} onSubmit={onVerifyCode}>
      <TextField
        label={t("auth.emailCodeLabel")}
        value={code}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onCodeChange(event.target.value)
        }
        placeholder={t("auth.emailCodePlaceholder")}
        type="tel"
        inputMode="numeric"
        required
        fullWidth
        slotProps={{ htmlInput: { maxLength: 6 } }}
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
  );
}

function SignInStatusMessages({
  status,
  t,
}: {
  status: SignInStatus;
  t: Translate;
}) {
  return (
    <>
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
    </>
  );
}

export { CodeStepForm, EmailStepForm, SignInHeader, SignInStatusMessages };
