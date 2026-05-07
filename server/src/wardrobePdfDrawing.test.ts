import test from "node:test";
import assert from "node:assert/strict";
import {
  addLinkAnnotation,
  drawColorValue,
  drawDetailGroup,
  drawRoundedRect,
  drawTextBlock,
  getRowText,
  measureTextBlockHeight,
  splitTextIntoLines,
  truncateLines
} from "./wardrobePdfDrawing.js";

function createFont(widthFactor = 0.5) {
  return {
    widthOfTextAtSize(text, size) {
      return String(text).length * size * widthFactor;
    }
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
    }
  };
}

test("text helpers split long words, truncate punctuation, draw, and measure text blocks", () => {
  const font = createFont(1);

  assert.deepEqual(splitTextIntoLines("", font, 10, 30), []);
  assert.deepEqual(splitTextIntoLines("alpha beta", font, 10, 50), ["alpha", "beta"]);
  assert.deepEqual(splitTextIntoLines("abcdefgh", font, 10, 30), ["abc", "def", "gh"]);
  assert.deepEqual(truncateLines(["One,", "Two!", "Three"], 2), ["One,", "Two..."]);
  assert.deepEqual(truncateLines(["One"], 2), ["One"]);

  const page = createPageRecorder();
  const cursorY = drawTextBlock(page, "alpha beta gamma", {
    x: 10,
    y: 100,
    width: 60,
    font,
    size: 10,
    lineHeight: 14,
    maxLines: 2
  });

  assert.equal(cursorY, 72);
  assert.deepEqual(page.calls.map((call) => call.text), ["alpha", "beta..."]);
  assert.equal(measureTextBlockHeight("alpha beta gamma", {
    font,
    size: 10,
    lineHeight: 14,
    width: 60,
    maxLines: 2
  }), 28);
  assert.equal(measureTextBlockHeight("", {
    font,
    size: 10,
    lineHeight: 14,
    width: 60
  }), 0);
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
    borderWidth: 2
  });

  assert.equal(page.calls.filter((call) => call.type === "rectangle").length, 4);
  assert.equal(page.calls.filter((call) => call.type === "circle").length, 8);
  assert.equal(page.calls[0].options.color, "border");
  assert.equal(page.calls[6].options.color, "fill");

  const flatPage = createPageRecorder();
  drawRoundedRect(flatPage, {
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    radius: -1,
    color: "fill"
  });
  assert.equal(flatPage.calls[0].options.width, 20);
  assert.equal(flatPage.calls[2].options.size, 0);
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
      }
    }
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
          push: (ref) => pushed.push(ref)
        };
      }
    }
  };

  addLinkAnnotation(pdfDoc, page, "", { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(page.node.Annots(), undefined);

  addLinkAnnotation(pdfDoc, page, "https://example.com/1", { x: 1, y: 2, width: 3, height: 4 });
  assert.equal(registered.length, 1);
  assert.equal(setCalls.length, 1);

  addLinkAnnotation(pdfDoc, page, "https://example.com/2", { x: 5, y: 6, width: 7, height: 8 });
  assert.equal(registered.length, 2);
  assert.deepEqual(pushed, [{ ref: 2 }]);
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
        { key: "empty", label: " " }
      ]
    }
  };

  assert.equal(getRowText(row), "Red, Blue,  ");
  assert.equal(getRowText({ value: { text: "Plain text" } }), "Plain text");
  assert.equal(getRowText(null), "");

  drawColorValue(page, row, { x: 10, y: 100, maxWidth: 28, fonts });

  assert.equal(page.calls.filter((call) => call.type === "circle").length, 2);
  assert.deepEqual(page.calls.filter((call) => call.type === "text").map((call) => call.text), ["Red", "Blue"]);
  assert.ok(page.calls.find((call) => call.type === "text" && call.text === "Blue").options.y < 100);
});

test("detail groups lay out mixed text and color rows in two columns", () => {
  const page = createPageRecorder();
  const fonts = { regularFont: createFont(0.5), boldFont: createFont(0.5) };
  const nextY = drawDetailGroup(page, {
    items: [
      { label: "Brand", value: { text: "Capsule" } },
      { label: "Description", value: { text: "Soft structured jacket for office looks" } },
      {
        label: "Colors",
        value: {
          kind: "colors",
          items: [{ key: "black", label: "Black" }]
        }
      }
    ]
  }, {
    startX: 20,
    startY: 300,
    width: 240,
    fonts
  });

  assert.ok(nextY < 300);
  assert.ok(page.calls.some((call) => call.type === "rectangle"));
  assert.ok(page.calls.some((call) => call.type === "circle"));
  assert.ok(page.calls.some((call) => call.type === "text" && call.text === "Brand"));
  assert.ok(page.calls.some((call) => call.type === "text" && call.text === "Capsule"));
});
