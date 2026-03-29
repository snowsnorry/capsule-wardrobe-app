import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmailSender,
  escapeHtml,
  getRequiredEnv,
  renderLoginCodeEmailHtml
} from "./email.js";

test("escapeHtml escapes critical HTML characters", () => {
  assert.equal(
    escapeHtml(`a&<>"'`),
    "a&amp;&lt;&gt;&quot;&#039;"
  );
});

test("renderLoginCodeEmailHtml injects escaped values and selects locale template", () => {
  const enHtml = renderLoginCodeEmailHtml({
    code: `<123&>`,
    expiresInMinutes: `5"`,
    locale: "en"
  });
  assert.match(enHtml, /Sign in with this code/);
  assert.ok(enHtml.includes("&lt;123&amp;&gt;"));
  assert.ok(enHtml.includes("5&quot; minute"));

  const ruHtml = renderLoginCodeEmailHtml({
    code: "654321",
    expiresInMinutes: 3,
    locale: "ru"
  });
  assert.match(ruHtml, /Войдите с этим кодом/);
  assert.ok(ruHtml.includes("654321"));
  assert.ok(ruHtml.includes("3 мин."));
});

test("getRequiredEnv throws a typed error for missing values", () => {
  const original = process.env.TEST_EMAIL_ENV_MISSING;
  delete process.env.TEST_EMAIL_ENV_MISSING;

  try {
    assert.throws(
      () => getRequiredEnv("TEST_EMAIL_ENV_MISSING"),
      (error) => error?.code === "missing_email_env"
    );
  } finally {
    if (original !== undefined) {
      process.env.TEST_EMAIL_ENV_MISSING = original;
    }
  }
});

test("sendLoginCodeEmail builds english resend payload with normalized locale and minimum ttl", async () => {
  let requestUrl = null;
  let requestInit = null;
  const sendLoginCodeEmail = createEmailSender({
    getRequiredEnvImpl: (name) => (
      name === "RESEND_API_KEY" ? "resend-key" : "hello@example.com"
    ),
    fetchImpl: async (url, init) => {
      requestUrl = url;
      requestInit = init;
      return {
        ok: true
      };
    }
  });

  await sendLoginCodeEmail({
    email: "person@example.com",
    code: "123456",
    locale: "de",
    expiresInMs: 1
  });

  assert.equal(requestUrl, "https://api.resend.com/emails");
  assert.equal(requestInit.method, "POST");
  assert.equal(requestInit.headers.Authorization, "Bearer resend-key");

  const payload = JSON.parse(requestInit.body);
  assert.deepEqual(payload.to, ["person@example.com"]);
  assert.equal(payload.from, "hello@example.com");
  assert.equal(payload.subject, "Your Capsule Wardrobe sign-in code");
  assert.match(payload.text, /Your sign-in code is: 123456/);
  assert.match(payload.text, /expires in 1 minute\(s\)/);
  assert.match(payload.html, /Sign in with this code/);
});

test("sendLoginCodeEmail builds russian resend payload and throws on resend failure", async () => {
  let requestInit = null;
  const sendLoginCodeEmail = createEmailSender({
    getRequiredEnvImpl: (name) => (
      name === "RESEND_API_KEY" ? "resend-key" : "hello@example.com"
    ),
    fetchImpl: async (_url, init) => {
      requestInit = init;
      return {
        ok: false,
        status: 502,
        text: async () => "bad gateway"
      };
    }
  });

  await assert.rejects(
    () => sendLoginCodeEmail({
      email: "person@example.com",
      code: "654321",
      locale: "ru",
      expiresInMs: 2 * 60 * 1000
    }),
    (error) => error?.code === "email_send_failed"
  );

  const payload = JSON.parse(requestInit.body);
  assert.equal(payload.subject, "Код входа в Capsule Wardrobe");
  assert.match(payload.text, /Ваш код для входа: 654321/);
  assert.match(payload.text, /Код действует 2 мин/);
  assert.match(payload.html, /Войдите с этим кодом/);
});
