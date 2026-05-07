import { test, expect } from "vitest";
import {
  createEmailSender,
  escapeHtml,
  getRequiredEnv,
  renderLoginCodeEmailHtml,
} from "./email.js";

type EmailError = Error & { code?: string };

type RequestInitCapture = {
  method: string;
  headers: {
    Authorization: string;
    "Content-Type": string;
  };
  body: string;
};

test("escapeHtml escapes critical HTML characters", () => {
  expect(escapeHtml(`a&<>"'`)).toBe("a&amp;&lt;&gt;&quot;&#039;");
});

test("renderLoginCodeEmailHtml injects escaped values and selects locale template", () => {
  const enHtml = renderLoginCodeEmailHtml({
    code: `<123&>`,
    expiresInMinutes: `5"`,
    locale: "en",
  });
  expect(enHtml).toMatch(/Sign in with this code/);
  expect(enHtml.includes("&lt;123&amp;&gt;")).toBeTruthy();
  expect(enHtml.includes("5&quot; minute")).toBeTruthy();

  const ruHtml = renderLoginCodeEmailHtml({
    code: "654321",
    expiresInMinutes: 3,
    locale: "ru",
  });
  expect(ruHtml).toMatch(/Войдите с этим кодом/);
  expect(ruHtml.includes("654321")).toBeTruthy();
  expect(ruHtml.includes("3 мин.")).toBeTruthy();
});

test("getRequiredEnv throws a typed error for missing values", () => {
  const original = process.env.TEST_EMAIL_ENV_MISSING;
  delete process.env.TEST_EMAIL_ENV_MISSING;

  try {
    getRequiredEnv("TEST_EMAIL_ENV_MISSING");
    throw new Error("Expected getRequiredEnv to throw");
  } catch (error) {
    expect((error as Error).message).toMatch(
      /TEST_EMAIL_ENV_MISSING is not set/,
    );
    expect((error as EmailError | undefined)?.code).toBe("missing_email_env");
  } finally {
    if (original !== undefined) {
      process.env.TEST_EMAIL_ENV_MISSING = original;
    }
  }
});

test("sendLoginCodeEmail builds english resend payload with normalized locale and minimum ttl", async () => {
  let requestUrl: string | null = null;
  let requestInit: RequestInitCapture | null = null;
  const sendLoginCodeEmail = createEmailSender({
    getRequiredEnvImpl: (name) =>
      name === "RESEND_API_KEY" ? "resend-key" : "hello@example.com",
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return {
        ok: true,
        text: async () => "",
      };
    },
  });

  await sendLoginCodeEmail({
    email: "person@example.com",
    code: "123456",
    locale: "de",
    expiresInMs: 1,
  });

  expect(requestUrl).toBe("https://api.resend.com/emails");
  expect(requestInit).toBeTruthy();
  expect(requestInit.method).toBe("POST");
  expect(requestInit.headers.Authorization).toBe("Bearer resend-key");

  const payload = JSON.parse(requestInit.body);
  expect(payload.to).toEqual(["person@example.com"]);
  expect(payload.from).toBe("hello@example.com");
  expect(payload.subject).toBe("Your Capsule Wardrobe sign-in code");
  expect(payload.text).toMatch(/Your sign-in code is: 123456/);
  expect(payload.text).toMatch(/expires in 1 minute\(s\)/);
  expect(payload.html).toMatch(/Sign in with this code/);
});

test("sendLoginCodeEmail builds russian resend payload and throws on resend failure", async () => {
  let requestInit: RequestInitCapture | null = null;
  const sendLoginCodeEmail = createEmailSender({
    getRequiredEnvImpl: (name) =>
      name === "RESEND_API_KEY" ? "resend-key" : "hello@example.com",
    fetchImpl: async (_url, init) => {
      requestInit = init;
      return {
        ok: false,
        status: 502,
        text: async () => "bad gateway",
      };
    },
  });

  await expect(
    sendLoginCodeEmail({
      email: "person@example.com",
      code: "654321",
      locale: "ru",
      expiresInMs: 2 * 60 * 1000,
    }),
  ).rejects.toMatchObject({ code: "email_send_failed" });

  expect(requestInit).toBeTruthy();
  const payload = JSON.parse(requestInit.body);
  expect(payload.subject).toBe("Код входа в Capsule Wardrobe");
  expect(payload.text).toMatch(/Ваш код для входа: 654321/);
  expect(payload.text).toMatch(/Код действует 2 мин/);
  expect(payload.html).toMatch(/Войдите с этим кодом/);
});
