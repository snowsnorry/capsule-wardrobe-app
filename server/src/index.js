import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  CODE_TTL_MS,
  RESEND_COOLDOWN_MS,
  MAX_CODE_SENDS_PER_HOUR,
  MAX_VERIFY_ATTEMPTS,
  SESSION_TTL_MS,
  createPendingCode,
  verifyCode,
  createSession,
  getSession,
  revokeSession
} from "./authStore.js";
import { sendLoginCodeEmail } from "./email.js";
import {
  createProfile,
  deleteProfile,
  getStylePreferences,
  getWardrobeOccasions,
  getProfile,
  hasProfile,
  updateProfile
} from "./profileStore.js";

const PORT = process.env.PORT || 3000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const NODE_ENV = process.env.NODE_ENV || "development";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST_PATH = path.resolve(__dirname, "../../client/dist");
const CLIENT_ROOT = path.resolve(__dirname, "../../client");

const app = express();

app.use(express.json());

if (NODE_ENV !== "development") {
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", CLIENT_ORIGIN);
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    return next();
  });
}

function parseCookies(cookieHeader = "") {
  return cookieHeader.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function setSessionCookie(res, sessionId) {
  const secure = NODE_ENV === "production";
  const sameSite = secure ? "None" : "Lax";
  const parts = [
    `session=${encodeURIComponent(sessionId)}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    `SameSite=${sameSite}`
  ];
  if (secure) {
    parts.push("Secure");
  }
  res.header("Set-Cookie", parts.join("; "));
}

function clearSessionCookie(res) {
  res.header("Set-Cookie", "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax");
}

function requireAuth(req, res, next) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (!sessionId) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.user = { email: session.email };
  return next();
}

app.post("/auth/request-code", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "invalid_email" });
  }

  const result = createPendingCode(email);
  if (!result.ok) {
    if (result.reason === "cooldown") {
      return res.status(429).json({ error: "cooldown", retryAfterMs: RESEND_COOLDOWN_MS });
    }
    if (result.reason === "rate_limit") {
      return res.status(429).json({ error: "rate_limit", maxPerHour: MAX_CODE_SENDS_PER_HOUR });
    }
  }

  await sendLoginCodeEmail({ email, code: result.code });
  return res.json({ ok: true, expiresInMs: CODE_TTL_MS });
});

app.post("/auth/verify-code", (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const code = String(req.body?.code || "").trim();
  if (!email || !code) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const result = verifyCode(email, code);
  if (!result.ok) {
    if (result.reason === "expired") {
      return res.status(400).json({ error: "expired" });
    }
    if (result.reason === "max_attempts") {
      return res.status(429).json({ error: "max_attempts", maxAttempts: MAX_VERIFY_ATTEMPTS });
    }
    return res.status(400).json({ error: "invalid" });
  }

  const { sessionId, session } = createSession(email);
  setSessionCookie(res, sessionId);
  return res.json({ ok: true, user: { email: session.email } });
});

app.post("/auth/logout", (req, res) => {
  const cookies = parseCookies(req.headers.cookie);
  if (cookies.session) {
    revokeSession(cookies.session);
  }
  clearSessionCookie(res);
  return res.json({ ok: true });
});

app.get("/auth/me", requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

app.get("/profile/status", requireAuth, (req, res) => {
  res.json({ ok: true, hasProfile: hasProfile(req.user.email) });
});

app.get("/profile/me", requireAuth, (req, res) => {
  const profile = getProfile(req.user.email);
  if (!profile) {
    return res.status(404).json({ error: "not_found" });
  }
  return res.json({ ok: true, profile });
});

app.get("/profile/style-preferences", requireAuth, (req, res) => {
  res.json({ ok: true, items: getStylePreferences() });
});

app.get("/profile/wardrobe-occasions", requireAuth, (req, res) => {
  res.json({ ok: true, items: getWardrobeOccasions() });
});

app.post("/profile/initialize", requireAuth, (req, res) => {
  if (hasProfile(req.user.email)) {
    return res.status(409).json({ error: "profile_exists" });
  }

  const stylePreferences = Array.isArray(req.body?.stylePreferences)
    ? req.body.stylePreferences
    : [];
  const wardrobeOccasions = Array.isArray(req.body?.wardrobeOccasions)
    ? req.body.wardrobeOccasions
    : [];

  if (stylePreferences.length === 0 || wardrobeOccasions.length === 0) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const profile = createProfile(req.user.email, {
    stylePreferences,
    wardrobeOccasions
  });

  return res.json({ ok: true, profile });
});

app.patch("/profile/me", requireAuth, (req, res) => {
  const stylePreferences = Array.isArray(req.body?.stylePreferences)
    ? req.body.stylePreferences
    : [];
  const wardrobeOccasions = Array.isArray(req.body?.wardrobeOccasions)
    ? req.body.wardrobeOccasions
    : [];

  if (stylePreferences.length === 0 || wardrobeOccasions.length === 0) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const profile = updateProfile(req.user.email, {
    stylePreferences,
    wardrobeOccasions
  });

  if (!profile) {
    return res.status(404).json({ error: "not_found" });
  }

  return res.json({ ok: true, profile });
});

app.delete("/profile/me", requireAuth, (req, res) => {
  if (!hasProfile(req.user.email)) {
    return res.status(404).json({ error: "not_found" });
  }
  deleteProfile(req.user.email);
  return res.json({ ok: true });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const startServer = async () => {
  if (NODE_ENV === "development") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      root: CLIENT_ROOT,
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      if (
        req.originalUrl.startsWith("/auth") ||
        req.originalUrl.startsWith("/profile") ||
        req.originalUrl.startsWith("/health")
      ) {
        return next();
      }

      try {
        const htmlPath = path.join(CLIENT_ROOT, "index.html");
        const template = await fs.promises.readFile(htmlPath, "utf-8");
        const html = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (error) {
        vite.ssrFixStacktrace(error);
        next(error);
      }
      return undefined;
    });
  } else if (fs.existsSync(CLIENT_DIST_PATH)) {
    app.use(express.static(CLIENT_DIST_PATH));

    app.get("*", (req, res) => {
      if (
        req.path.startsWith("/auth") ||
        req.path.startsWith("/profile") ||
        req.path.startsWith("/health")
      ) {
        return res.status(404).json({ error: "not_found" });
      }
      return res.sendFile(path.join(CLIENT_DIST_PATH, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
};

startServer();
