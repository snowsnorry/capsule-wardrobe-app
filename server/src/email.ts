import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RESEND_API_URL = "https://api.resend.com/emails";
const DEFAULT_CODE_TTL_MS = 5 * 60 * 1000;
const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNIN_EMAIL_TEMPLATE_EN_PATH = join(
  __dirname,
  "templates",
  "signin_email.html",
);
const SIGNIN_EMAIL_TEMPLATE_RU_PATH = join(
  __dirname,
  "templates",
  "signin_email.ru.html",
);
const SIGNIN_EMAIL_TEMPLATE_EN = readFileSync(
  SIGNIN_EMAIL_TEMPLATE_EN_PATH,
  "utf8",
);
const SIGNIN_EMAIL_TEMPLATE_RU = readFileSync(
  SIGNIN_EMAIL_TEMPLATE_RU_PATH,
  "utf8",
);

type SupportedLocale = "en" | "ru";

type EmailErrorCode = "missing_email_env" | "email_send_failed";

type EmailError = Error & {
  code?: EmailErrorCode;
};

type RequiredEnvGetter = (name: string) => string;

type RenderLoginCodeEmailHtmlInput = {
  code: string | number;
  expiresInMinutes: string | number;
  locale: SupportedLocale;
};

type SendLoginCodeEmailInput = {
  email: string;
  code: string;
  locale?: string;
  expiresInMs?: number;
};

type ResendEmailPayload = {
  from: string;
  to: [string];
  subject: string;
  html: string;
  text: string;
};

type FetchResponseLike = {
  ok: boolean;
  status?: number;
  text(): Promise<string>;
};

type FetchLike = (
  input: string,
  init: {
    method: "POST";
    headers: {
      Authorization: string;
      "Content-Type": "application/json";
    };
    body: string;
  },
) => Promise<FetchResponseLike>;

type CreateEmailSenderDeps = {
  fetchImpl?: FetchLike;
  getRequiredEnvImpl?: RequiredEnvGetter;
};

function normalizeLocale(locale: string | undefined): SupportedLocale {
  return locale === "ru" ? "ru" : "en";
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    const error = new Error(`${name} is not set`);
    (error as EmailError).code = "missing_email_env";
    throw error;
  }
  return value;
}

function escapeHtml(value: string | number): string {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderLoginCodeEmailHtml({
  code,
  expiresInMinutes,
  locale,
}: RenderLoginCodeEmailHtmlInput): string {
  const safeCode = escapeHtml(code);
  const safeMinutes = escapeHtml(expiresInMinutes);
  const template =
    locale === "ru" ? SIGNIN_EMAIL_TEMPLATE_RU : SIGNIN_EMAIL_TEMPLATE_EN;

  return template
    .replaceAll("{{CODE}}", safeCode)
    .replaceAll("{{EXPIRES_IN_MINUTES}}", safeMinutes);
}

function createEmailSender({
  fetchImpl = fetch as FetchLike,
  getRequiredEnvImpl = getRequiredEnv,
}: CreateEmailSenderDeps = {}) {
  return async function sendLoginCodeEmail({
    email,
    code,
    locale = "en",
    expiresInMs = DEFAULT_CODE_TTL_MS,
  }: SendLoginCodeEmailInput): Promise<void> {
    const apiKey = getRequiredEnvImpl("RESEND_API_KEY");
    const from = getRequiredEnvImpl("RESEND_FROM_EMAIL");
    const expiresInMinutes = Math.max(1, Math.ceil(expiresInMs / (60 * 1000)));
    const normalizedLocale = normalizeLocale(locale);
    const html = renderLoginCodeEmailHtml({
      code,
      expiresInMinutes,
      locale: normalizedLocale,
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
            "Если вы не запрашивали этот код, просто проигнорируйте письмо.",
          ].join("\n")
        : [
            `Your sign-in code is: ${code}`,
            "",
            `This code expires in ${expiresInMinutes} minute(s).`,
            "If you did not request this code, you can ignore this email.",
          ].join("\n");

    const resendPayload: ResendEmailPayload = {
      from,
      to: [email],
      subject,
      html,
      text,
    };

    const response = await fetchImpl(RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendPayload),
    });

    if (!response.ok) {
      const details = await response.text();
      const error = new Error(
        `Failed to send email via Resend: ${response.status} ${details}`,
      );
      (error as EmailError).code = "email_send_failed";
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
  sendLoginCodeEmail,
};
