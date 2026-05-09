import { logError } from "../logger.js";

export function registerHealthImageRoutes(app, context) {
  const { checkDatabaseConnectionImpl } = context;

  app.get("/health", (req, res) => {
    return res.json({ ok: true });
  });

  app.get("/healthall", async (req, res) => {
    try {
      await checkDatabaseConnectionImpl();
      return res.json({ ok: true });
    } catch (error) {
      logError("[healthall]", error);
      return res.status(503).json({ ok: false });
    }
  });
}
