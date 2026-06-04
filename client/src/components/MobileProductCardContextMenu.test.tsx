import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import MobileProductCardContextMenu from "./MobileProductCardContextMenu";
import type {
  ClothingCardItem,
  MobileContextMenuOriginRect,
} from "./ClothingCardTypes";

vi.mock("../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const theme = createTheme();

const item: ClothingCardItem = {
  id: "item-1",
  name: "Navy relaxed shirt",
  brand: "E2E Studio",
  category: "top",
  imageUrl: "https://example.com/navy-shirt.jpg",
  url: "https://example.com/products/navy-shirt",
};

const originalAnimate = HTMLElement.prototype.animate;

function renderMenu({
  originRect,
}: { originRect?: MobileContextMenuOriginRect } = {}) {
  return render(
    <ThemeProvider theme={theme}>
      <MobileProductCardContextMenu
        actions={<button type="button">Action</button>}
        item={item}
        label="Navy relaxed shirt"
        open
        originRect={originRect}
        onClose={vi.fn()}
      />
    </ThemeProvider>,
  );
}

describe("MobileProductCardContextMenu", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    if (originalAnimate) {
      Object.defineProperty(HTMLElement.prototype, "animate", {
        configurable: true,
        value: originalAnimate,
      });
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "animate");
    }
  });

  test("animates the preview card from the source card rect", async () => {
    const animate = vi.fn(() => ({
      cancel: vi.fn(),
      finished: Promise.resolve(),
    }));
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      callback(0);
      return 1;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(
      () => undefined,
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      top: 80,
      left: 40,
      width: 300,
      height: 400,
      right: 340,
      bottom: 480,
      x: 40,
      y: 80,
      toJSON: () => ({}),
    });

    renderMenu({
      originRect: { top: 20, left: 10, width: 120, height: 160 },
    });

    await waitFor(() => expect(animate).toHaveBeenCalled());
    expect(animate).toHaveBeenCalledWith(
      [
        {
          transform: "translate3d(-30px, -60px, 0) scale(0.4, 0.4)",
          transformOrigin: "top left",
        },
        {
          transform: "translate3d(0, 0, 0) scale(1, 1)",
          transformOrigin: "top left",
        },
      ],
      {
        duration: 220,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
        fill: "both",
      },
    );
  });

  test("renders without morph animation when no origin rect is provided", () => {
    const animate = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "animate", {
      configurable: true,
      value: animate,
    });

    renderMenu();

    expect(screen.getByRole("dialog", { name: "Navy relaxed shirt" }));
    expect(screen.getByRole("button", { name: "Action" })).toBeVisible();
    expect(animate).not.toHaveBeenCalled();
  });

  test("keeps the shared preview container borderless and transparent", () => {
    const { container } = renderMenu();

    const dialogPaper = screen.getByRole("dialog", {
      name: "Navy relaxed shirt",
    });
    const previewPaper = container.ownerDocument.querySelector(
      ".wardrobe-card-root",
    )?.parentElement;
    const dialogPaperStyle = getComputedStyle(dialogPaper);
    const previewPaperStyle = getComputedStyle(previewPaper as HTMLElement);

    expect(dialogPaperStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(dialogPaperStyle.backgroundImage).toBe("none");
    expect(dialogPaperStyle.borderWidth).toBe("0px");
    expect(previewPaperStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");
    expect(previewPaperStyle.backgroundImage).toBe("none");
    expect(previewPaperStyle.borderWidth).toBe("0px");
  });

  test("suppresses native browser image interactions inside the preview card", async () => {
    const { container } = renderMenu();

    expect(screen.getByRole("dialog", { name: "Navy relaxed shirt" }));
    const previewCard = container.ownerDocument.querySelector(
      ".wardrobe-card-root",
    );
    expect(previewCard).toBeInstanceOf(HTMLElement);
    const event = createEvent.contextMenu(previewCard as HTMLElement);
    fireEvent(previewCard as HTMLElement, event);

    expect(event.defaultPrevented).toBe(true);
    const previewImage = await screen.findByRole("img", {
      name: "Navy relaxed shirt",
    });
    expect(previewImage).toHaveAttribute("draggable", "false");
    expect(previewImage).toHaveStyle("user-select: none;");
  });
});
