import {
  drawCoverageSection,
  drawOutfitReadinessSection,
  drawOverviewSection,
  drawScoresSection,
  drawVersatilitySection,
} from "./wardrobePdfPersonalItemsReportBasicSections.js";
import {
  drawConfidenceSection,
  drawIssuesSection,
  drawStrengthsSection,
  drawSuggestionsSection,
} from "./wardrobePdfPersonalItemsReportFindingSections.js";
import {
  drawColorAnalysisSection,
  drawEfficiencySection,
  drawSeasonalitySection,
  drawStyleProfileSection,
} from "./wardrobePdfPersonalItemsReportProfileSections.js";
import { createItemResolver } from "./wardrobePdfPersonalItemsReportPrimitives.js";

export function drawPersonalItemsReportDetailSections(
  pdfDoc,
  state,
  { fonts, locale, products = [], report },
) {
  const resolveItems = createItemResolver(products, locale);
  state = drawScoresSection(pdfDoc, state, { fonts, locale, report });
  state = drawOverviewSection(pdfDoc, state, { fonts, locale, report });
  state = drawCoverageSection(pdfDoc, state, { fonts, locale, report });
  state = drawOutfitReadinessSection(pdfDoc, state, { fonts, locale, report });
  state = drawVersatilitySection(pdfDoc, state, { fonts, locale, report });
  state = drawStyleProfileSection(pdfDoc, state, {
    fonts,
    locale,
    report,
    resolveItems,
  });
  state = drawSeasonalitySection(pdfDoc, state, { fonts, locale, report });
  state = drawColorAnalysisSection(pdfDoc, state, { fonts, locale, report });
  state = drawEfficiencySection(pdfDoc, state, {
    fonts,
    locale,
    report,
    resolveItems,
  });
  state = drawStrengthsSection(pdfDoc, state, {
    fonts,
    locale,
    report,
    resolveItems,
  });
  state = drawIssuesSection(pdfDoc, state, {
    fonts,
    locale,
    report,
    resolveItems,
  });
  state = drawSuggestionsSection(pdfDoc, state, {
    fonts,
    locale,
    report,
    resolveItems,
  });
  return drawConfidenceSection(pdfDoc, state, { fonts, locale, report });
}
