import { Button, Divider, Link, Stack, TextField, Typography } from "@mui/material";
import { useI18n } from "../i18n/useI18n.js";

function SignInScreen({
  step,
  email,
  code,
  status,
  onEmailChange,
  onCodeChange,
  onRequestCode,
  onVerifyCode,
  onResetEmail
}) {
  const { t } = useI18n();
  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Typography variant="h4">{t("auth.signInTitle")}</Typography>
        <Typography variant="body2" color="text.secondary">
          {step === "email"
            ? t("auth.signInSubtitleEmail")
            : t("auth.signInSubtitleCode")}
        </Typography>
      </Stack>

      <Divider />

      {step === "email" ? (
        <Stack component="form" spacing={2} onSubmit={onRequestCode}>
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
      {status.info ? (
        <Typography variant="body2" color="text.secondary">
          {status.info}
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
