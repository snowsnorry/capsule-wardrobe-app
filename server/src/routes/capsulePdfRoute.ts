import { logError } from "../logger.js";

export function registerCapsulePdfRoute(app, context) {
  app.post(
    "/capsules/:id/pdf",
    context.requireTrustedOrigin,
    context.requireAuth,
    context.requireCsrf,
    async (req, res) => {
      try {
        const capsule = await context.getCapsuleImpl(
          req.user.email,
          req.params.id,
        );
        if (!capsule) {
          return res.status(404).json({ error: "not_found" });
        }
        const profile = await context.getProfileImpl(req.user.email);
        const items = context.getCapsuleItems(capsule);
        if (items.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }
        const productUrls = items
          .map((item) => String((item as { url?: unknown })?.url || "").trim())
          .filter(Boolean);
        const products =
          await context.getProductsByUrlsInOrderImpl(productUrls);
        if (products.length === 0) {
          return res.status(404).json({ error: "not_found" });
        }
        const pdfBuffer = await context.buildWardrobePdfInChildImpl(
          products,
          String(profile?.locale || "en"),
        );
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          context.buildPdfDownloadFilename(capsule?.name),
        );
        return res.status(200).send(pdfBuffer);
      } catch (error) {
        logError("[capsules/pdf]", error);
        return res.status(503).json({ error: "service_unavailable" });
      }
    },
  );
}
