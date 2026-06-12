import { rgb } from "pdf-lib";
import { CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN } from "./wardrobePdfCore.js";

const REPORT_PAGE_PADDING = 0;
export const REPORT_CONTENT_X = PAGE_MARGIN + REPORT_PAGE_PADDING;
export const REPORT_CONTENT_WIDTH = CONTENT_WIDTH - REPORT_PAGE_PADDING * 2;
export const REPORT_CONTENT_TOP =
  PAGE_HEIGHT - PAGE_MARGIN - REPORT_PAGE_PADDING;
export const REPORT_CONTENT_BOTTOM = PAGE_MARGIN + REPORT_PAGE_PADDING;

export const INK_COLOR = rgb(0.122, 0.161, 0.2);
export const SECONDARY_COLOR = rgb(0.322, 0.376, 0.427);
export const BORDER_COLOR = rgb(0.88, 0.88, 0.86);
export const WARNING_COLOR = rgb(0.608, 0.416, 0.02);
export const WARNING_WASH_COLOR = rgb(1, 0.945, 0.761);
export const ERROR_COLOR = rgb(0.824, 0.263, 0.263);
export const ERROR_WASH_COLOR = rgb(0.992, 0.886, 0.882);
export const SUCCESS_COLOR = rgb(0.184, 0.561, 0.345);
export const SUCCESS_WASH_COLOR = rgb(0.882, 0.952, 0.906);
export const NEUTRAL_WASH_COLOR = rgb(0.945, 0.95, 0.956);

export const BULLET_BODY_X = REPORT_CONTENT_X + 20;
export const BULLET_BODY_WIDTH = REPORT_CONTENT_WIDTH - 20;
export const BULLET_FONT_SIZE = 10.7;
export const BULLET_LINE_HEIGHT = 14.4;
export const BULLET_BOTTOM_GAP = 3;
