import { t } from "../../shared/i18n/helpers.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BODY_X,
  REPORT_CONTENT_X,
} from "./wardrobePdfOutfitConstants.js";
import { formatReportValue, toPercent } from "./wardrobePdfOutfitReport.js";
import { measureBulletTextHeight } from "./wardrobePdfCapsuleReportBullets.js";
import { ensureReportBlockSpace } from "./wardrobePdfOutfitDrawing.js";
import {
  addBulletBottomGap,
  cleanString,
  drawBulletMarker,
  drawInlineChip,
  drawPrefixedText,
  drawRelatedItemsRow,
  drawReportSectionTitle,
  drawTextListSection,
  drawValueRows,
  getInlineChipLayout,
  measurePrefixedTextHeight,
  measureRelatedItemsHeight,
  optionalRow,
  REPORT_BODY_WIDTH,
  REPORT_LINE_HEIGHT,
  resolveRelatedItemLabels,
  severityToReportTone,
} from "./wardrobePdfPersonalItemsReportPrimitives.js";

const BULLET_X = REPORT_CONTENT_X + 5;
const CHIP_GAP = 7;
const SUGGESTION_VALUE_LABEL_WIDTH = 168;

export function drawStrengthsSection(
  pdfDoc,
  state,
  { fonts, locale, report, resolveItems },
) {
  const strengths = (report?.strengths || []).filter(
    (strength) => strength?.message || strength?.supportingItemIds?.length,
  );
  if (!strengths.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: getStrengthHeight({
      fonts,
      locale,
      resolveItems,
      strength: strengths[0],
    }),
    title: t("wardrobe.reportStrengths", undefined, locale),
  });

  for (const strength of strengths) {
    state = drawStrengthBlock(pdfDoc, state, {
      fonts,
      locale,
      resolveItems,
      strength,
    });
  }

  state.cursorY -= 12;
  return state;
}

function getStrengthHeight({ fonts, locale, resolveItems, strength }) {
  const labels = resolveRelatedItemLabels(
    strength?.supportingItemIds,
    resolveItems,
  );
  return (
    measurePrefixedTextHeight({
      fonts,
      prefix: strength?.dimension
        ? `${formatReportValue(strength.dimension)}:`
        : "",
      text: strength?.message,
      width: REPORT_BODY_WIDTH,
    }) +
    measureRelatedItemsHeight({
      fonts,
      labels,
      locale,
      width: REPORT_BODY_WIDTH,
    }) +
    6
  );
}

function drawStrengthBlock(
  pdfDoc,
  state,
  { fonts, locale, resolveItems, strength },
) {
  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    getStrengthHeight({ fonts, locale, resolveItems, strength }),
  );
  drawBulletMarker(state.page, {
    tone: "success",
    x: BULLET_X,
    y: state.cursorY,
  });
  state = drawPrefixedText(pdfDoc, state, {
    fonts,
    prefix: strength?.dimension
      ? `${formatReportValue(strength.dimension)}:`
      : "",
    text: strength?.message,
    width: BULLET_BODY_WIDTH,
    x: BULLET_BODY_X,
  });
  state = drawRelatedItemsRow(pdfDoc, state, {
    fonts,
    labels: resolveRelatedItemLabels(strength?.supportingItemIds, resolveItems),
    locale,
  });
  return addBulletBottomGap(state);
}

export function drawIssuesSection(
  pdfDoc,
  state,
  { fonts, locale, report, resolveItems },
) {
  const issues = report?.issues || [];
  if (!issues.length) return state;

  const firstIssue = issues.find(
    (issue) => issue?.message || issue?.suggestion,
  );
  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: firstIssue
      ? getIssueHeight({ fonts, issue: firstIssue, locale, resolveItems })
      : 0,
    title: t("wardrobe.reportIssues", undefined, locale),
  });

  for (const issue of issues) {
    state = drawIssueBlock(pdfDoc, state, {
      fonts,
      issue,
      locale,
      resolveItems,
    });
  }

  state.cursorY -= 12;
  return state;
}

function getIssueHeight({ fonts, issue, locale, resolveItems }) {
  const severity = cleanString(issue?.severity);
  const chipWidth = severity
    ? getInlineChipLayout(severity, fonts).width + CHIP_GAP
    : 0;
  const relatedLabels = resolveRelatedItemLabels(
    issue?.affectedItemIds,
    resolveItems,
  );
  return (
    Math.max(
      REPORT_LINE_HEIGHT,
      measurePrefixedTextHeight({
        fonts,
        prefix: issue?.dimension
          ? `${formatReportValue(issue.dimension)}:`
          : "",
        text: issue?.message,
        width: BULLET_BODY_WIDTH - chipWidth,
      }),
    ) +
    measurePrefixedTextHeight({
      fonts,
      prefix: issue?.suggestion
        ? t("wardrobe.reportIssueSuggestionLabel", undefined, locale)
        : "",
      text: issue?.suggestion,
      width: BULLET_BODY_WIDTH,
    }) +
    measureRelatedItemsHeight({
      fonts,
      labels: relatedLabels,
      locale,
      width: BULLET_BODY_WIDTH,
    }) +
    6
  );
}

function drawIssueBlock(pdfDoc, state, { fonts, issue, locale, resolveItems }) {
  const severity = cleanString(issue?.severity);
  if (!issueHasContent(issue, severity)) return state;

  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    getIssueHeight({ fonts, issue, locale, resolveItems }),
  );
  drawBulletMarker(state.page, {
    tone: getIssueTone(issue),
    x: BULLET_X,
    y: state.cursorY,
  });

  const messageLayout = drawIssueSeverityChip(state, { fonts, severity });
  state = drawPrefixedTextOrReserveLine(pdfDoc, state, {
    forceLine: Boolean(severity),
    fonts,
    prefix: getIssueDimensionPrefix(issue),
    text: issue?.message,
    width: messageLayout.width,
    x: messageLayout.x,
  });
  state = drawPrefixedTextOrReserveLine(pdfDoc, state, {
    forceLine: false,
    fonts,
    prefix: getIssueSuggestionPrefix(issue, locale),
    text: issue?.suggestion,
    width: BULLET_BODY_WIDTH,
    x: BULLET_BODY_X,
  });
  state = drawRelatedItemsRow(pdfDoc, state, {
    fonts,
    labels: resolveRelatedItemLabels(issue?.affectedItemIds, resolveItems),
    locale,
  });
  return addBulletBottomGap(state);
}

function issueHasContent(issue, severity) {
  return Boolean(
    severity ||
    issue?.dimension ||
    issue?.message ||
    issue?.suggestion ||
    issue?.affectedItemIds?.length,
  );
}

function drawIssueSeverityChip(state, { fonts, severity }) {
  if (!severity) {
    return { width: BULLET_BODY_WIDTH, x: BULLET_BODY_X };
  }

  const chip = drawInlineChip(state.page, {
    fonts,
    label: severity,
    x: BULLET_BODY_X,
    y: state.cursorY,
  });
  return {
    width: BULLET_BODY_WIDTH - chip.width - CHIP_GAP,
    x: BULLET_BODY_X + chip.width + CHIP_GAP,
  };
}

function getIssueDimensionPrefix(issue) {
  return issue?.dimension ? `${formatReportValue(issue.dimension)}:` : "";
}

function getIssueSuggestionPrefix(issue, locale) {
  return issue?.suggestion
    ? t("wardrobe.reportIssueSuggestionLabel", undefined, locale)
    : "";
}

function getIssueTone(issue) {
  return severityToReportTone(issue?.severity);
}

export function drawSuggestionsSection(
  pdfDoc,
  state,
  { fonts, locale, report, resolveItems },
) {
  const suggestions = (report?.suggestions || []).filter(
    (suggestion) => suggestion?.message || suggestion?.targetItemIds?.length,
  );
  if (!suggestions.length) return state;

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: getSuggestionHeight({
      fonts,
      locale,
      resolveItems,
      suggestion: suggestions[0],
    }),
    title: t("wardrobe.reportSuggestions", undefined, locale),
  });

  for (const suggestion of suggestions) {
    state = drawSuggestionBlock(pdfDoc, state, {
      fonts,
      locale,
      resolveItems,
      suggestion,
    });
  }

  state.cursorY -= 12;
  return state;
}

function getSuggestionHeight({ fonts, locale, resolveItems, suggestion }) {
  const priority = cleanString(suggestion?.priority);
  const chipWidth = priority
    ? getInlineChipLayout(priority, fonts).width + CHIP_GAP
    : 0;
  const rows = getSuggestionRows(suggestion, locale);
  const relatedLabels = resolveRelatedItemLabels(
    suggestion?.targetItemIds,
    resolveItems,
  );
  return (
    Math.max(
      REPORT_LINE_HEIGHT,
      measurePrefixedTextHeight({
        fonts,
        prefix: suggestion?.type
          ? `${formatReportValue(suggestion.type)}:`
          : "",
        text: suggestion?.message,
        width: BULLET_BODY_WIDTH - chipWidth,
      }),
    ) +
    rows.filter(Boolean).length * 20 +
    measureRelatedItemsHeight({
      fonts,
      labels: relatedLabels,
      locale,
      width: BULLET_BODY_WIDTH,
    }) +
    8
  );
}

function drawSuggestionBlock(
  pdfDoc,
  state,
  { fonts, locale, resolveItems, suggestion },
) {
  state = ensureReportBlockSpace(
    pdfDoc,
    state,
    getSuggestionHeight({ fonts, locale, resolveItems, suggestion }),
  );
  drawBulletMarker(state.page, {
    tone: "success",
    x: BULLET_X,
    y: state.cursorY,
  });

  const priority = cleanString(suggestion?.priority);
  let textWidth = BULLET_BODY_WIDTH;
  if (priority) {
    const chipLayout = getInlineChipLayout(priority, fonts);
    drawInlineChip(state.page, {
      fonts,
      label: priority,
      x: BULLET_BODY_X + BULLET_BODY_WIDTH - chipLayout.width,
      y: state.cursorY,
    });
    textWidth -= chipLayout.width + CHIP_GAP;
  }

  state = drawPrefixedTextOrReserveLine(pdfDoc, state, {
    forceLine: Boolean(priority),
    fonts,
    prefix: suggestion?.type ? `${formatReportValue(suggestion.type)}:` : "",
    text: suggestion?.message,
    width: textWidth,
    x: BULLET_BODY_X,
  });
  state = drawValueRows(pdfDoc, state, {
    fonts,
    labelWidth: SUGGESTION_VALUE_LABEL_WIDTH,
    rowX: BULLET_BODY_X,
    rows: getSuggestionRows(suggestion, locale),
    width: BULLET_BODY_WIDTH,
  });
  state = drawRelatedItemsRow(pdfDoc, state, {
    fonts,
    labels: resolveRelatedItemLabels(suggestion?.targetItemIds, resolveItems),
    locale,
  });
  return addBulletBottomGap(state);
}

export function getSuggestionRows(suggestion, locale) {
  return [
    optionalRow(
      "impact",
      t("wardrobe.reportExpectedImpact", undefined, locale),
      suggestion?.expectedImpact,
    ),
    optionalRow(
      "target",
      t("wardrobe.reportTargetCategory", undefined, locale),
      suggestion?.targetCategory,
    ),
    optionalRow(
      "replacement-category",
      t("wardrobe.reportReplacementCategory", undefined, locale),
      suggestion?.replacementCategory,
    ),
    optionalRow(
      "replacement-description",
      t("wardrobe.reportReplacementDescription", undefined, locale),
      suggestion?.replacementDescription,
    ),
  ];
}

function drawPrefixedTextOrReserveLine(
  pdfDoc,
  state,
  { fonts, forceLine, prefix = "", text, width, x },
) {
  const previousY = state.cursorY;
  state = drawPrefixedText(pdfDoc, state, {
    fonts,
    prefix,
    text,
    width,
    x,
  });
  if (forceLine && state.cursorY === previousY) {
    state.cursorY -= REPORT_LINE_HEIGHT;
  }
  return state;
}

export function drawConfidenceSection(
  pdfDoc,
  state,
  { fonts, locale, report },
) {
  const percent = toPercent(report?.confidence?.overall);
  const lowConfidenceAspects = report?.confidence?.lowConfidenceAspects || [];
  const assumptions = report?.confidence?.assumptions || [];
  if (percent === null && !lowConfidenceAspects.length && !assumptions.length) {
    return state;
  }

  state = drawReportSectionTitle(pdfDoc, state, {
    fonts,
    keepWithHeight: getConfidenceKeepWithHeight({
      assumptions,
      fonts,
      lowConfidenceAspects,
    }),
    title: getConfidenceTitle({ locale, percent }),
  });
  state = drawTextListSection(pdfDoc, state, {
    fonts,
    items: lowConfidenceAspects,
    locale,
    titleKey: "wardrobe.reportLowConfidenceAspects",
    tone: "warning",
  });
  return drawTextListSection(pdfDoc, state, {
    fonts,
    items: assumptions,
    locale,
    titleKey: "wardrobe.reportAssumptions",
  });
}

function getConfidenceKeepWithHeight({
  assumptions,
  fonts,
  lowConfidenceAspects,
}) {
  const firstLine = lowConfidenceAspects[0] || assumptions[0] || "";
  return firstLine ? measureBulletTextHeight(String(firstLine), fonts) : 0;
}

function getConfidenceTitle({ locale, percent }) {
  const label = t("wardrobe.reportConfidence", undefined, locale);
  return percent === null ? label : `${label}: ${percent}%`;
}
