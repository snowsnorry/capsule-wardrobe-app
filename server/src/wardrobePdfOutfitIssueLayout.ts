import { t } from "../../shared/i18n/helpers.js";
import { splitTextIntoLines } from "./wardrobePdfDrawing.js";
import {
  BULLET_BODY_WIDTH,
  BULLET_BOTTOM_GAP,
  BULLET_FONT_SIZE,
  BULLET_LINE_HEIGHT,
} from "./wardrobePdfOutfitConstants.js";

function splitTextWithFirstLineWidth(text, font, size, firstWidth, restWidth) {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return [];

  const firstLineWords = [];
  while (words.length) {
    const candidate = [...firstLineWords, words[0]].join(" ");
    if (
      firstLineWords.length > 0 &&
      font.widthOfTextAtSize(candidate, size) > firstWidth
    ) {
      break;
    }
    firstLineWords.push(words.shift());
  }

  const lines = [firstLineWords.join(" ")].filter(Boolean);
  const rest = words.join(" ");
  if (rest) {
    lines.push(...splitTextIntoLines(rest, font, size, restWidth));
  }

  return lines;
}

export function getIssueBulletLayout({ fonts, issue, locale }) {
  const message = String(issue?.message || "").trim();
  const suggestion = String(issue?.suggestion || "").trim();
  const suggestionLabel = t(
    "outfit.reportIssueSuggestionLabel",
    undefined,
    locale,
  );
  const suggestionLabelWidth =
    suggestionLabel && suggestion
      ? fonts.boldFont.widthOfTextAtSize(suggestionLabel, BULLET_FONT_SIZE) + 4
      : 0;
  const messageLines = message
    ? splitTextIntoLines(
        message,
        fonts.regularFont,
        BULLET_FONT_SIZE,
        BULLET_BODY_WIDTH,
      )
    : [];
  const suggestionLines = suggestion
    ? splitTextWithFirstLineWidth(
        suggestion,
        fonts.regularFont,
        BULLET_FONT_SIZE,
        BULLET_BODY_WIDTH - suggestionLabelWidth,
        BULLET_BODY_WIDTH,
      )
    : [];

  return {
    messageLines,
    suggestion,
    suggestionLabel,
    suggestionLabelWidth,
    suggestionLines,
    height:
      (messageLines.length + suggestionLines.length) * BULLET_LINE_HEIGHT +
      BULLET_BOTTOM_GAP,
  };
}
