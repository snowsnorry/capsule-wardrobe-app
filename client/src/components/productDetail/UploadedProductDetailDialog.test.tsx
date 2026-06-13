import { afterEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { createAppTheme } from "../../theme";
import UploadedProductDetailDialog from "./UploadedProductDetailDialog";

const theme = createTheme();
const darkTheme = createAppTheme("dark");

const labels: Record<string, string> = {
  "actions.cancel": "Cancel",
  "filters.apply": "Apply",
  "wardrobe.imageVersionToggle.ai": "AI",
  "wardrobe.imageVersionToggle.label": "Uploaded item image version",
  "wardrobe.imageVersionToggle.original": "Original",
  "wardrobe.uploadedDetail.fields.brand": "Brand",
  "wardrobe.uploadedDetail.fields.description": "Description",
  "wardrobe.uploadedDetail.fields.name": "Name",
  "wardrobe.uploadedDetail.missingRequired":
    "To apply changes, fill in: {items}.",
  "wardrobe.uploadedDetail.notSpecified": "Not specified",
  "wardrobe.uploadedDetail.required.audience": "audience",
  "wardrobe.uploadedDetail.required.category": "category",
  "wardrobe.uploadedDetail.required.name": "name",
  "wardrobe.uploadedDetail.required.season": "at least one season",
  "search.productDetailsTitle": "Product details",
  "search.fields.audience": "Audience",
  "search.fields.closureType": "Closure type",
  "search.fields.color": "Color",
  "search.fields.composition": "Composition",
  "search.fields.finish": "Finish",
  "search.fields.fit": "Fit",
  "search.fields.formalityLevel": "Formality",
  "search.fields.occasions": "Occasions",
  "search.fields.pattern": "Pattern",
  "search.fields.season": "Season",
  "search.fields.silhouette": "Silhouette",
  "search.fields.style": "Style",
  "search.filters.category": "Category",
  "search.untitled": "Untitled product",
};

const t = (key: string, params?: Record<string, unknown>) => {
  const template = labels[key] ?? key;
  return Object.entries(params || {}).reduce(
    (value, [paramKey, paramValue]) =>
      value.replace(`{${paramKey}}`, String(paramValue)),
    template,
  );
};

const validItem = {
  id: "uploaded-1",
  name: "Linen shirt",
  description: "Button-front shirt",
  brand: "Studio",
  source: "uploaded",
  imageUrl: "https://example.com/shirt.jpg",
  rawImageUrl: "https://example.com/shirt-original.jpg",
  audience: "unisex",
  category: "top",
  season: ["summer"],
  formalityLevel: ["casual"],
  style: ["minimalistic"],
  occasions: ["office"],
  colorBase: ["white"],
  pattern: "solid",
  finish: null,
  composition: "linen, cotton",
  silhouette: null,
  fit: "regular",
  closureType: ["button"],
};

function renderDialog(
  props: Partial<Parameters<typeof UploadedProductDetailDialog>[0]> = {},
  renderTheme = theme,
) {
  return render(
    <ThemeProvider theme={renderTheme}>
      <UploadedProductDetailDialog
        item={validItem}
        open
        isMobile={false}
        locale="en"
        t={t}
        onClose={vi.fn()}
        onApply={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("UploadedProductDetailDialog", () => {
  test("renders editable uploaded item fields with the product details title", () => {
    renderDialog();

    expect(screen.getByText("Product details")).toBeInTheDocument();
    expect(
      document.querySelector(".uploaded-detail-camera-icon"),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Linen shirt")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Linen shirt" })).toHaveStyle({
      objectFit: "contain",
    });
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Button-front shirt",
    );
    expect(screen.getByLabelText(/Brand/)).toHaveValue("Studio");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Apply" })).toBeEnabled();
    expect(screen.getAllByText("Not specified").length).toBeGreaterThan(0);
  });

  test("keeps mobile edit actions in a right-aligned footer outside the scrollable body", () => {
    renderDialog({ isMobile: true });

    const content = screen
      .getByDisplayValue("Linen shirt")
      .closest(".MuiDialogContent-root");
    const footer = screen
      .getByRole("button", { name: "Apply" })
      .closest(".MuiDialogActions-root");
    const applyButton = screen.getByRole("button", { name: "Apply" });
    const cancelButton = screen.getByRole("button", { name: "Cancel" });

    expect(footer).not.toBeNull();
    expect(content!.contains(footer)).toBe(false);
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
    expect(
      cancelButton.compareDocumentPosition(applyButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(applyButton).toHaveClass("MuiButton-contained");
  });

  test("preserves trailing spaces while editing text fields", () => {
    renderDialog();

    fireEvent.change(screen.getByLabelText(/Brand/), {
      target: { value: "Studio " },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "Button-front shirt " },
    });

    expect(screen.getByLabelText(/Brand/)).toHaveValue("Studio ");
    expect(screen.getByLabelText(/Description/)).toHaveValue(
      "Button-front shirt ",
    );
  });

  test("disables Apply and explains missing required fields", () => {
    renderDialog({
      item: {
        id: "uploaded-1",
        source: "uploaded",
        name: "",
        audience: null,
        category: null,
        season: [],
      },
    });

    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
    expect(
      screen.getByText(
        "To apply changes, fill in: name, audience, category, at least one season.",
      ),
    ).toBeInTheDocument();
  });

  test("sends normalized payload and closes on Apply", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onApply, onClose });

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({ id: "uploaded-1" }),
      expect.objectContaining({
        audience: "all",
        composition: "linen, cotton",
        name: "Linen shirt",
      }),
    );
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  test("applies representative text, single-select, and multi-select edits", async () => {
    const onApply = vi.fn();
    renderDialog({
      item: {
        ...validItem,
        audience: "women",
      },
      onApply,
    });

    fireEvent.change(screen.getByDisplayValue("Linen shirt"), {
      target: { value: "  Updated shirt  " },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: "  Updated description  " },
    });
    fireEvent.change(screen.getByLabelText(/Brand/), {
      target: { value: "  Updated brand  " },
    });
    selectSingle("Audience", "Man");
    selectSingle("Category", "Dress");
    selectMulti("Season", "Winter");

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledWith(
        expect.objectContaining({ id: "uploaded-1" }),
        expect.objectContaining({
          audience: "man",
          brand: "Updated brand",
          category: "dress",
          description: "Updated description",
          name: "Updated shirt",
        }),
      );
    });
    const payload = onApply.mock.calls[0][1];
    expect(payload.season).toContain("winter");
  });

  test("keeps the dialog open when Apply fails and supports mobile layout", async () => {
    const onApply = vi.fn(() => Promise.reject(new Error("failed")));
    const onClose = vi.fn();
    renderDialog({ isMobile: true, onApply, onClose }, darkTheme);

    const title = screen.getByText("Product details");
    expect(title.closest(".MuiDialogTitle-root")).toHaveStyle({
      backgroundColor: darkTheme.palette.background.paper,
      minHeight: "60px",
      paddingTop: "12px",
      paddingBottom: "8px",
    });
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Product actions" }),
    ).toBeNull();

    expect(document.querySelector(".MuiDialogContent-root")).toHaveStyle({
      backgroundColor: darkTheme.palette.background.default,
      overflowY: "auto",
      paddingLeft: "24px",
      paddingRight: "24px",
      paddingTop: "8px",
      paddingBottom: "32px",
    });
    expect(
      screen
        .getByRole("button", { name: "Apply" })
        .closest(".MuiDialogActions-root"),
    ).not.toBeNull();
    expect(screen.getByLabelText(/Name/).closest(".MuiStack-root")).toHaveStyle(
      {
        paddingTop: "6px",
      },
    );
    expect(
      document.querySelector(".uploaded-detail-camera-icon"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("product-detail-dialog-image-pane"),
    ).not.toBeInTheDocument();
    const mobileImage = screen.getByRole("img", { name: "Linen shirt" });
    expect(mobileImage).toHaveStyle({
      width: "100%",
      borderRadius: "var(--cw-radius-detail)",
    });
    expect(screen.getByRole("button", { name: "AI" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    expect(mobileImage).toHaveAttribute(
      "src",
      "https://example.com/shirt-original.jpg",
    );
    expect(screen.getByRole("button", { name: "Original" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => {
      expect(onApply).toHaveBeenCalledTimes(1);
    });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  test("closes on Cancel without applying", () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderDialog({ onApply, onClose });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onApply).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

function selectSingle(label: string, option: string) {
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: new RegExp(label) }),
  );
  fireEvent.click(screen.getByRole("option", { name: option }));
}

function selectMulti(label: string, option: string) {
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: new RegExp(label) }),
  );
  fireEvent.click(screen.getByRole("option", { name: option }));
  fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
}
