import { setCsrfCookie, setSessionCookie } from "../httpCookies.js";
import { E2E_EMAIL } from "./fixtures.js";
import { e2eState } from "./state.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lcrPrwAAAABJRU5ErkJggg==",
  "base64",
);

function normalizeScenario(value: unknown) {
  return value === "no-profile" ? "no-profile" : "with-profile";
}

function setAuthCookies(res, sessionId: string, csrfToken: string) {
  setSessionCookie(res, sessionId, "development");
  setCsrfCookie(res, csrfToken, "development");
}

export function registerE2eRoutes(app) {
  app.post("/__e2e/reset", (req, res) => {
    e2eState.reset(normalizeScenario(req.body?.scenario));
    return res.json({ ok: true, scenario: e2eState.scenario });
  });

  app.post("/__e2e/login", (req, res) => {
    const email = String(req.body?.email || E2E_EMAIL).trim() || E2E_EMAIL;
    const { sessionId, session } = e2eState.createSession(email);
    setAuthCookies(res, sessionId, session.csrfToken);
    return res.json({ ok: true, user: { email } });
  });

  app.get("/__e2e/images/:name.svg", (req, res) => {
    const label = String(req.params?.name || "fixture");
    const escaped = label.replace(/[<>&"]/g, "");
    return res
      .type("image/svg+xml")
      .send(
        `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="420" viewBox="0 0 320 420"><rect width="320" height="420" fill="#f3efe6"/><rect x="48" y="64" width="224" height="292" rx="18" fill="#35536b"/><text x="160" y="384" text-anchor="middle" font-family="Arial" font-size="20" fill="#222">${escaped}</text></svg>`,
      );
  });

  app.get("/__e2e/thumbnails/:name", (_req, res) => {
    return res.type("image/png").send(ONE_PIXEL_PNG);
  });
}
