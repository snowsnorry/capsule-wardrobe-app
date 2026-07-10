import { logError } from "../logger.js";
import { RELEASE_METADATA } from "../appConfig.js";

export function registerHealthImageRoutes(app, context) {
  const { checkDatabaseConnectionImpl, releaseMetadata = RELEASE_METADATA } =
    context;

  app.get("/health", (req, res) => {
    return res.json({ ok: true, release: releaseMetadata });
  });

  app.get("/healthall", async (req, res) => {
    try {
      await checkDatabaseConnectionImpl();
      return res.json({
        ok: true,
        release: releaseMetadata,
        dependencies: { database: "ok" },
      });
    } catch (error) {
      logError("health.images.failed", error);
      return res.status(503).json({
        ok: false,
        release: releaseMetadata,
        dependencies: { database: "error" },
      });
    }
  });

  app.get("/internal/metrics", (req, res) => {
    return res.status(403).json({ error: "forbidden" });
  });
}
