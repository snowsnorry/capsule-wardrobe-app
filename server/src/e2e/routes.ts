import { setCsrfCookie, setSessionCookie } from "../httpCookies.js";
import { buildCapsuleEventSnapshot } from "../ai/capsuleEvents.js";
import { E2E_EMAIL } from "./fixtures.js";
import { e2eState, type E2eScenario } from "./state.js";
import type { JobKind } from "../jobs/types.js";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lcrPrwAAAABJRU5ErkJggg==",
  "base64",
);

const SCENARIOS = new Set<E2eScenario>([
  "with-profile",
  "no-profile",
  "with-saved-search",
  "with-non-empty-stats",
  "empty-wardrobe",
]);
const JOB_KINDS = new Set<JobKind>([
  "capsuleGenerate",
  "capsuleRegenerateSelected",
  "capsuleReportGenerate",
  "outfitImageGenerate",
  "outfitReportGenerate",
  "outfitSetImageGenerate",
  "personalItemsReportGenerate",
  "personalItemUploadFiles",
  "personalItemUploadUrls",
]);

function normalizeScenario(value: unknown): E2eScenario {
  const scenario = String(value || "with-profile");
  return SCENARIOS.has(scenario as E2eScenario)
    ? (scenario as E2eScenario)
    : "with-profile";
}

function setAuthCookies(res, sessionId: string, csrfToken: string) {
  setSessionCookie(res, sessionId, "development");
  setCsrfCookie(res, csrfToken, "development");
}

function isGenerationRegenerateAllFailure(req) {
  const domain = String(req.body?.domain || "generation");
  const action = String(req.body?.action || "regenerate-all");
  return (
    domain === "generation" &&
    (action === "regenerate-all" || action === "regenerate-capsule")
  );
}

function registerGenerationControlRoutes(app) {
  // E2E full-generation controls:
  // POST /__e2e/generation/mode { mode: "immediate" | "pending" | "fail-once" }
  // POST /__e2e/generation/release { capsuleId?: string, email?: string }
  app.post("/__e2e/generation/mode", (req, res) => {
    const mode = e2eState.generationMemory.setFailureMode(req.body?.mode);
    if (!mode) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    return res.json({
      ok: true,
      mode,
      failure: e2eState.generationMemory.cloneFailureState(),
    });
  });

  app.post("/__e2e/fail-once", (req, res) => {
    if (!isGenerationRegenerateAllFailure(req)) {
      return res.status(400).json({ error: "invalid_payload" });
    }
    const failure = e2eState.generationMemory.failOnce({
      domain: req.body?.domain || "generation",
      action: req.body?.action || "regenerate-all",
    });
    return res.json({ ok: true, failure });
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

  app.post("/__e2e/generation/fail", (req, res) => {
    const email = String(req.body?.email || E2E_EMAIL).trim() || E2E_EMAIL;
    const job = e2eState.generationMemory.failWardrobeJob({
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
      status: "failed",
    });
  });
}

function normalizeJobKinds(value: unknown): JobKind[] {
  const values = Array.isArray(value) ? value : [];
  return values
    .map((kind) => String(kind || "").trim())
    .filter((kind): kind is JobKind => JOB_KINDS.has(kind as JobKind));
}

function registerJobControlRoutes(app) {
  app.post("/__e2e/jobs/manual-mode", (req, res) => {
    if (!e2eState.jobControls) {
      return res.status(503).json({ error: "not_ready" });
    }
    const kinds = normalizeJobKinds(req.body?.kinds);
    const manualKinds = e2eState.jobControls.setManualMode(kinds);
    return res.json({ ok: true, manualKinds });
  });

  app.post("/__e2e/jobs/:jobId/release", async (req, res) => {
    const job = await e2eState.jobControls?.completeManualJob(
      String(req.params?.jobId || ""),
    );
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, job });
  });

  app.post("/__e2e/jobs/:jobId/fail", (req, res) => {
    const job = e2eState.jobControls?.failManualJob(
      String(req.params?.jobId || ""),
      String(req.body?.errorCode || "e2e_forced_failure"),
    );
    if (!job) {
      return res.status(404).json({ error: "not_found" });
    }
    return res.json({ ok: true, job });
  });
}

function registerSeedRoutes(app) {
  app.post("/__e2e/seed/sidebar-lists", (req, res) => {
    const capsuleCount = Number(req.body?.capsules || 0);
    const outfitCount = Number(req.body?.outfits || 0);
    const capsules = e2eState.capsuleMemory.seedMany(
      capsuleCount,
      "Sidebar capsule",
    );
    const outfits = e2eState.outfitMemory.seedMany(
      outfitCount,
      "Sidebar outfit",
    );
    return res.json({
      ok: true,
      capsules: capsules.map((capsule) => ({
        id: capsule.id,
        name: capsule.name,
      })),
      outfits: outfits.map((outfit) => ({ id: outfit.id, name: outfit.name })),
    });
  });
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

  registerGenerationControlRoutes(app);
  registerJobControlRoutes(app);
  registerSeedRoutes(app);

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
