import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_CODE_TTL_MS = 5 * 60 * 1000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNIN_EMAIL_TEMPLATE_EN_PATH = join(__dirname, "templates", "signin_email.html");
const SIGNIN_EMAIL_TEMPLATE_RU_PATH = join(__dirname, "templates", "signin_email.ru.html");
const SIGNIN_EMAIL_TEMPLATE_EN = readFileSync(SIGNIN_EMAIL_TEMPLATE_EN_PATH, "utf8");
const SIGNIN_EMAIL_TEMPLATE_RU = readFileSync(SIGNIN_EMAIL_TEMPLATE_RU_PATH, "utf8");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not set`);
    error.code = "missing_email_env";
    throw error;
  }
  return value;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLoginCodeEmailHtml({ code, expiresInMinutes, locale }) {
  const safeCode = escapeHtml(code);
  const safeMinutes = escapeHtml(expiresInMinutes);
  const template = locale === "ru" ? SIGNIN_EMAIL_TEMPLATE_RU : SIGNIN_EMAIL_TEMPLATE_EN;

  return template
    .replaceAll("{{CODE}}", safeCode)
    .replaceAll("{{EXPIRES_IN_MINUTES}}", safeMinutes);
}

function createEmailSender({
  fetchImpl = fetch,
  getRequiredEnvImpl = getRequiredEnv
} = {}) {
  return async function sendLoginCodeEmail({
    email,
    code,
    locale = "en",
    expiresInMs = DEFAULT_CODE_TTL_MS
  }) {
    const apiKey = getRequiredEnvImpl("RESEND_API_KEY");
    const from = getRequiredEnvImpl("RESEND_FROM_EMAIL");
    const expiresInMinutes = Math.max(1, Math.ceil(expiresInMs / (60 * 1000)));
    const normalizedLocale = locale === "ru" ? "ru" : "en";
    const html = renderLoginCodeEmailHtml({
      code,
      expiresInMinutes,
      locale: normalizedLocale
    });
    const subject =
      normalizedLocale === "ru"
        ? "Код входа в Capsule Wardrobe"
        : "Your Capsule Wardrobe sign-in code";
    const text =
      normalizedLocale === "ru"
        ? [
            `Ваш код для входа: ${code}`,
            "",
            `Код действует ${expiresInMinutes} мин.`,
            "Если вы не запрашивали этот код, просто проигнорируйте письмо."
          ].join("\n")
        : [
            `Your sign-in code is: ${code}`,
            "",
            `This code expires in ${expiresInMinutes} minute(s).`,
            "If you did not request this code, you can ignore this email."
          ].join("\n");

    const response = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
        text
      })
    });

    if (!response.ok) {
      const details = await response.text();
      const error = new Error(`Failed to send email via Resend: ${response.status} ${details}`);
      error.code = "email_send_failed";
      throw error;
    }
  };
}

const sendLoginCodeEmail = createEmailSender();

export {
  createEmailSender,
  escapeHtml,
  getRequiredEnv,
  renderLoginCodeEmailHtml,
  sendLoginCodeEmail
};
