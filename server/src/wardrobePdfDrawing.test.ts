import { test, expect } from "vitest";
import {
  addLinkAnnotation,
  drawColorValue,
  drawDetailGroup,
  drawRoundedRect,
  drawTextBlock,
  getRowText,
  measureTextBlockHeight,
  splitTextIntoLines,
  truncateLines,
} from "./wardrobePdfDrawing.js";

function createFont(widthFactor = 0.5) {
  return {
    widthOfTextAtSize(text, size) {
      return String(text).length * size * widthFactor;
    },
  };
}

function createPageRecorder() {
  const calls = [];
  return {
    calls,
    drawRectangle(options) {
      calls.push({ type: "rectangle", options });
    },
    drawCircle(options) {
      calls.push({ type: "circle", options });
    },
    drawText(text, options) {
      calls.push({ type: "text", text, options });
    },
  };
}

test("text helpers split long words, truncate punctuation, draw, and measure text blocks", () => {
  const font = createFont(1);

  expect(splitTextIntoLines("", font, 10, 30)).toEqual([]);
  expect(splitTextIntoLines("alpha beta", font, 10, 50)).toEqual([
    "alpha",
    "beta",
  ]);
  expect(splitTextIntoLines("abcdefgh", font, 10, 30)).toEqual([
    "abc",
    "def",
    "gh",
  ]);
  expect(truncateLines(["One,", "Two!", "Three"], 2)).toEqual([
    "One,",
    "Two...",
  ]);
  expect(truncateLines(["One"], 2)).toEqual(["One"]);

  const page = createPageRecorder();
  const cursorY = drawTextBlock(page, "alpha beta gamma", {
    x: 10,
    y: 100,
    width: 60,
    font,
    size: 10,
    lineHeight: 14,
    maxLines: 2,
  });

  expect(cursorY).toBe(72);
  expect(page.calls.map((call) => call.text)).toEqual(["alpha", "beta..."]);
  expect(
    measureTextBlockHeight("alpha beta gamma", {
      font,
      size: 10,
      lineHeight: 14,
      width: 60,
      maxLines: 2,
    }),
  ).toBe(28);
  expect(
    measureTextBlockHeight("", {
      font,
      size: 10,
      lineHeight: 14,
      width: 60,
    }),
  ).toBe(0);
});

test("rounded rectangles clamp radius and draw border and fill shapes", () => {
  const page = createPageRecorder();

  drawRoundedRect(page, {
    x: 10,
    y: 20,
    width: 30,
    height: 20,
    radius: 50,
    color: "fill",
    borderColor: "border",
    borderWidth: 2,
  });

  expect(page.calls.filter((call) => call.type === "rectangle").length).toBe(4);
  expect(page.calls.filter((call) => call.type === "circle").length).toBe(8);
  expect(page.calls[0].options.color).toBe("border");
  expect(page.calls[6].options.color).toBe("fill");

  const flatPage = createPageRecorder();
  drawRoundedRect(flatPage, {
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    radius: -1,
    color: "fill",
  });
  expect(flatPage.calls[0].options.width).toBe(20);
  expect(flatPage.calls[2].options.size).toBe(0);
});

test("link annotations are skipped without URLs and appended to page annotations", () => {
  const registered = [];
  const pdfDoc = {
    context: {
      obj(value) {
        return { object: value };
      },
      register(value) {
        registered.push(value);
        return { ref: registered.length };
      },
    },
  };
  const pushed = [];
  const setCalls = [];
  const page = {
    node: {
      annots: undefined,
      Annots() {
        return this.annots;
      },
      set(name, value) {
        setCalls.push({ name, value });
        this.annots = {
          push: (ref) => pushed.push(ref),
        };
      },
    },
  };

  addLinkAnnotation(pdfDoc, page, "", { x: 1, y: 2, width: 3, height: 4 });
  expect(page.node.Annots()).toBe(undefined);

  addLinkAnnotation(pdfDoc, page, "https://example.com/1", {
    x: 1,
    y: 2,
    width: 3,
    height: 4,
  });
  expect(registered.length).toBe(1);
  expect(setCalls.length).toBe(1);

  addLinkAnnotation(pdfDoc, page, "https://example.com/2", {
    x: 5,
    y: 6,
    width: 7,
    height: 8,
  });
  expect(registered.length).toBe(2);
  expect(pushed).toEqual([{ ref: 2 }]);
});

test("color rows draw swatches, skip blank labels, and wrap within max width", () => {
  const page = createPageRecorder();
  const fonts = { regularFont: createFont(0.7), boldFont: createFont(0.7) };
  const row = {
    label: "Colors",
    value: {
      kind: "colors",
      items: [
        { key: "red", label: "Red" },
        { key: "blue", label: "Blue" },
        { key: "empty", label: " " },
      ],
    },
  };

  expect(getRowText(row)).toBe("Red, Blue,  ");
  expect(getRowText({ value: { text: "Plain text" } })).toBe("Plain text");
  expect(getRowText(null)).toBe("");

  drawColorValue(page, row, { x: 10, y: 100, maxWidth: 28, fonts });

  expect(page.calls.filter((call) => call.type === "circle").length).toBe(2);
  expect(
    page.calls.filter((call) => call.type === "text").map((call) => call.text),
  ).toEqual(["Red", "Blue"]);
  expect(
    page.calls.find((call) => call.type === "text" && call.text === "Blue")
      .options.y < 100,
  ).toBeTruthy();
});

test("detail groups lay out mixed text and color rows in two columns", () => {
  const page = createPageRecorder();
  const fonts = { regularFont: createFont(0.5), boldFont: createFont(0.5) };
  const nextY = drawDetailGroup(
    page,
    {
      items: [
        { label: "Brand", value: { text: "Capsule" } },
        {
          label: "Description",
          value: { text: "Soft structured jacket for office looks" },
        },
        {
          label: "Colors",
          value: {
            kind: "colors",
            items: [{ key: "black", label: "Black" }],
          },
        },
      ],
    },
    {
      startX: 20,
      startY: 300,
      width: 240,
      fonts,
    },
  );

  expect(nextY < 300).toBeTruthy();
  expect(page.calls.some((call) => call.type === "rectangle")).toBeTruthy();
  expect(page.calls.some((call) => call.type === "circle")).toBeTruthy();
  expect(
    page.calls.some((call) => call.type === "text" && call.text === "Brand"),
  ).toBeTruthy();
  expect(
    page.calls.some((call) => call.type === "text" && call.text === "Capsule"),
  ).toBeTruthy();
});
