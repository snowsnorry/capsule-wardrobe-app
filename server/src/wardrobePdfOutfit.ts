import { t } from "../../shared/i18n/helpers.js";
import { drawOutfitImageCoverPage } from "./wardrobePdfOutfitCover.js";
import { drawOutfitReportPages } from "./wardrobePdfOutfitReportPages.js";
import {
  collectReportText,
  formatReportValue,
  getReportChipValues,
  getReportScoreRows,
  getReportTemperatureLabel,
  getReportVerdictLabel,
  toPercent,
} from "./wardrobePdfOutfitReport.js";
import { hasNonLatinText } from "./wardrobePdfRuntime.js";

function outfitNeedsUnicodeFallback(outfit, locale) {
  if (locale === "ru") {
    return true;
  }

  return [
    outfit?.title,
    outfit?.imageUrl,
    t("capsule.outfitSetImageObsolete", undefined, locale),
    t("outfit.reportOutdated", undefined, locale),
    t("outfit.reportTitle", undefined, locale),
    ...collectReportText(outfit?.report),
  ].some(hasNonLatinText);
}

export {
  drawOutfitImageCoverPage,
  drawOutfitReportPages,
  formatReportValue,
  getReportChipValues,
  getReportScoreRows,
  getReportTemperatureLabel,
  getReportVerdictLabel,
  outfitNeedsUnicodeFallback,
  toPercent,
};
