import { setCsrfCookie, setSessionCookie } from "../httpCookies.js";
import { buildCapsuleEventSnapshot } from "../ai/capsuleEvents.js";
import { E2E_EMAIL } from "./fixtures.js";
import { e2eState } from "./state.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lcrPrwAAAABJRU5ErkJggg==",
  "base64",
);

const SCENARIOS = new Set([
  "with-profile",
  "no-profile",
  "with-saved-search",
  "with-non-empty-stats",
]);

function normalizeScenario(value: unknown) {
  const scenario = String(value || "with-profile");
  return SCENARIOS.has(scenario) ? scenario : "with-profile";
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

  // E2E full-generation controls:
  // POST /__e2e/generation/mode { mode: "immediate" | "pending" }
  // POST /__e2e/generation/release { capsuleId?: string, email?: string }
  app.post("/__e2e/generation/mode", (req, res) => {
    const mode = e2eState.generationMemory.setMode(req.body?.mode);
    if (!mode) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    return res.json({ ok: true, mode });
  });

  app.post("/__e2e/generation/release", (req, res) => {
    const email = String(req.body?.email || E2E_EMAIL).trim() || E2E_EMAIL;
    const job = e2eState.generationMemory.releaseWardrobeJob({
      capsuleMemory: e2eState.capsuleMemory,
      capsuleId: req.body?.capsuleId,
      email,
    });
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }

    const capsule = e2eState.capsuleMemory.get(job.capsuleId);
    const snapshot = buildCapsuleEventSnapshot({
      capsule,
      activeJob: e2eState.generationMemory.getJob(email, job.capsuleId),
      partialRegenerationJob: e2eState.selectedRegenerationMemory.getJob(
        email,
        job.capsuleId,
      ),
    });
    const published = e2eState.generationMemory.publish(
      email,
      job.capsuleId,
      snapshot,
      { close: true },
    );

    return res.json({
      ok: true,
      capsuleId: job.capsuleId,
      jobId: job.capsuleRequestId,
      published,
      status: "ready",
    });
  });

  // E2E search gate controls:
  // POST /__e2e/search/delay { query: string, match?: "exact" | "includes" }
  // POST /__e2e/search/release { query?: string, match?: "exact" | "includes" }
  // GET /__e2e/search/requests returns cloned request metadata for polling.
  app.post("/__e2e/search/delay", (req, res) => {
    if (!String(req.body?.query || "").trim()) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const gate = e2eState.searchDelay.configureGate({
      query: req.body?.query,
      match: req.body?.match,
    });
    return res.json({ ok: true, gate });
  });

  app.post("/__e2e/search/release", (req, res) => {
    const result = e2eState.searchDelay.releaseGate({
      query: req.body?.query,
      match: req.body?.match,
    });
    return res.json({ ok: true, ...result });
  });

  app.get("/__e2e/search/requests", (_req, res) => {
    return res.json({
      ok: true,
      requests: e2eState.searchDelay.cloneRequestLog(),
    });
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
