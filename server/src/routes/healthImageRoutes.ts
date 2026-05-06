import fs from "node:fs";
import path from "node:path";
import { logError } from "../logger.js";

export function registerHealthImageRoutes(app, context) {
  const {
    checkDatabaseConnectionImpl,
    imageStorageDir
  } = context;

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

app.get("/images/:filename", async (req, res) => {
  const filename = String(req.params.filename || "");
  if (!/^[a-f0-9]{64}\.jpg$/.test(filename)) {
    return res.status(404).json({ error: "not_found" });
  }

  const imagePath = path.join(String(imageStorageDir || ""), filename);
  try {
    const buffer = await fs.promises.readFile(imagePath);
    return res
      .status(200)
      .set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=3600"
      })
      .send(buffer);
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return res.status(404).json({ error: "not_found" });
    }
    logError("[images]", error);
    return res.status(503).json({ error: "service_unavailable" });
  }
});

app.get("/images/*", (_req, res) => {
  return res.status(404).json({ error: "not_found" });
});
}
