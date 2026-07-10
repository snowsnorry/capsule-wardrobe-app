import { sortWardrobeItems } from "../../shared/wardrobeOrder.js";
import type { WardrobePdfJobState } from "./ai/types.js";
import { logError } from "./logger.js";
import {
  WARDROBE_PDF_POLL_AFTER_MS,
  getStoredWardrobeItems,
  normalizeStoredPdf,
  type ProfileWithPdfResult,
  type WardrobePdfJobOptions,
} from "./wardrobePdfCore.js";

export function createDownloadWardrobePdf({
  loadProfileWithPdf,
  ensureWardrobePdfJob,
}: {
  loadProfileWithPdf: (email: string) => Promise<ProfileWithPdfResult>;
  ensureWardrobePdfJob: (
    email: string,
    options?: WardrobePdfJobOptions,
  ) => Promise<WardrobePdfJobState | null>;
}) {
  async function downloadWardrobePdf(req, res) {
    try {
      const email = req.user.email;
      const { profile, pdf } = await loadProfileWithPdf(email);
      const storedWardrobeItems = sortWardrobeItems(
        getStoredWardrobeItems(profile),
      );

      if (storedWardrobeItems.length === 0) {
        return res.status(404).json({ error: "not_found" });
      }

      const storedPdf = normalizeStoredPdf(pdf);
      if (storedPdf) {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="capsule-wardrobe.pdf"',
        );
        return res.status(200).send(storedPdf);
      }

      await ensureWardrobePdfJob(email, {
        wardrobePayload: profile?.items,
        locale: typeof profile?.locale === "string" ? profile.locale : null,
      });

      return res.status(202).json({
        ok: true,
        status: "pending",
        pollAfterMs: WARDROBE_PDF_POLL_AFTER_MS,
      });
    } catch (error) {
      logError("pdf.download.failed", error);
      return res.status(503).json({ error: "service_unavailable" });
    }
  }

  return downloadWardrobePdf;
}
