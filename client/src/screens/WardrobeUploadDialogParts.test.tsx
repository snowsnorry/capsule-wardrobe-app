import { createRef, type ReactElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  SelectedFilesList,
  UploadDropzone,
  UploadProgressContent,
  formatFileSize,
} from "./WardrobeUploadDialogParts";

const theme = createTheme();
const translations: Record<string, string> = {
  "myWardrobe.uploadDialog.dropzoneLabel": "Choose wardrobe photos",
  "myWardrobe.uploadDialog.dropzoneTitle": "Drop images here",
  "myWardrobe.uploadDialog.dropzoneHint": "JPEG, PNG, or WebP. Up to 5 files.",
  "myWardrobe.uploadDialog.mobileDropzoneTitle": "Choose photos",
  "myWardrobe.uploadDialog.mobileDropzoneHint":
    "JPEG, PNG, or WebP. Up to 5 files, 10 MB each.",
  "myWardrobe.uploadDialog.fileList": "Selected files",
  "myWardrobe.uploadDialog.selectedSummary": "{count} files, {size}",
  "myWardrobe.uploadDialog.removeFile": "Remove {name}",
  "myWardrobe.uploadDialog.uploadedStatus": "Uploaded: {image_count}",
  "myWardrobe.uploadDialog.metadataProcessedStatus":
    "Metadata processed: {image_count}",
  "myWardrobe.uploadDialog.imageProcessedStatus":
    "Images processed: {image_count}",
  "myWardrobe.uploadDialog.failedStatus": "Failed: {image_count}",
};

function t(key: string) {
  return translations[key] || key;
}

function renderWithTheme(ui: ReactElement) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("WardrobeUploadDialogParts", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("formats file sizes", () => {
    expect(formatFileSize(1)).toBe("1 KB");
    expect(formatFileSize(1536)).toBe("2 KB");
    expect(formatFileSize(1024 * 1024 * 2.25)).toBe("2.3 MB");
  });

  test("renders upload processing progress counts", () => {
    renderWithTheme(
      <UploadProgressContent
        progress={{
          total: 5,
          uploaded: 5,
          completedSteps: 12,
          metadataProcessed: 3,
          imageProcessed: 3,
          failed: 1,
        }}
        t={t}
      />,
    );

    expect(screen.getByText("Uploaded: 5")).toBeInTheDocument();
    expect(screen.getByText("Metadata processed: 3")).toBeInTheDocument();
    expect(screen.getByText("Images processed: 3")).toBeInTheDocument();
    expect(screen.getByText("Failed: 1")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "80",
    );
  });

  test("renders indeterminate progress when total is unknown", () => {
    renderWithTheme(
      <UploadProgressContent
        progress={{
          total: 0,
          uploaded: 0,
          completedSteps: 0,
          metadataProcessed: 0,
          imageProcessed: 0,
          failed: 0,
        }}
        t={t}
      />,
    );

    expect(screen.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
    );
  });

  test("dropzone handles pointer, keyboard, drag, drop, and input changes", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    const onDragStateChange = vi.fn();
    const onDrop = vi.fn((event) => event.preventDefault());
    const onFileInputChange = vi.fn();
    const file = new File(["image"], "shirt.webp", { type: "image/webp" });

    renderWithTheme(
      <UploadDropzone
        inputRef={createRef<HTMLInputElement>()}
        isDragging={false}
        onDragStateChange={onDragStateChange}
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
        t={t}
      />,
    );

    const dropzone = screen.getByRole("button", {
      name: "Choose wardrobe photos",
    });
    fireEvent.click(dropzone);
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.keyDown(dropzone, { key: " " });
    fireEvent.dragEnter(dropzone);
    fireEvent.dragOver(dropzone);
    fireEvent.dragLeave(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.change(document.querySelector("input") as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(inputClick).toHaveBeenCalledTimes(3);
    expect(onDragStateChange).toHaveBeenNthCalledWith(1, true);
    expect(onDragStateChange).toHaveBeenNthCalledWith(2, true);
    expect(onDragStateChange).toHaveBeenNthCalledWith(3, false);
    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(onFileInputChange).toHaveBeenCalledTimes(1);
  });

  test("mobile dropzone uses touch-first copy without drag behavior", () => {
    const inputClick = vi
      .spyOn(HTMLInputElement.prototype, "click")
      .mockImplementation(() => undefined);
    const onDragStateChange = vi.fn();
    const onDrop = vi.fn((event) => event.preventDefault());
    const onFileInputChange = vi.fn();
    const file = new File(["image"], "shirt.webp", { type: "image/webp" });

    renderWithTheme(
      <UploadDropzone
        inputRef={createRef<HTMLInputElement>()}
        isDragging={false}
        onDragStateChange={onDragStateChange}
        onDrop={onDrop}
        onFileInputChange={onFileInputChange}
        t={t}
        variant="mobile"
      />,
    );

    const dropzone = screen.getByRole("button", {
      name: "Choose wardrobe photos",
    });
    expect(screen.getByText("Choose photos")).toBeInTheDocument();
    expect(
      screen.getByText("JPEG, PNG, or WebP. Up to 5 files, 10 MB each."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Drop images here")).not.toBeInTheDocument();

    fireEvent.click(dropzone);
    fireEvent.keyDown(dropzone, { key: "Enter" });
    fireEvent.dragEnter(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });
    fireEvent.change(document.querySelector("input") as HTMLInputElement, {
      target: { files: [file] },
    });

    expect(inputClick).toHaveBeenCalledTimes(2);
    expect(onDragStateChange).not.toHaveBeenCalled();
    expect(onDrop).not.toHaveBeenCalled();
    expect(onFileInputChange).toHaveBeenCalledTimes(1);
  });

  test("selected files list renders previews, fallback icons, and remove actions", () => {
    const onRemoveFile = vi.fn();
    const image = new File(["image"], "shirt.webp", { type: "image/webp" });
    const noPreview = new File(["image"], "pants.png", { type: "image/png" });

    renderWithTheme(
      <SelectedFilesList
        files={[
          { id: "file-1", file: image, previewUrl: "blob:shirt" },
          { id: "file-2", file: noPreview, previewUrl: "" },
        ]}
        onRemoveFile={onRemoveFile}
        t={t}
        totalSizeLabel="2 KB"
      />,
    );

    expect(screen.getByLabelText("Selected files")).toBeInTheDocument();
    expect(screen.getByText("2 files, 2 KB")).toBeInTheDocument();
    expect(screen.getByText("shirt.webp")).toBeInTheDocument();
    expect(screen.getByText("pants.png")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove pants.png" }));

    expect(onRemoveFile).toHaveBeenCalledWith("file-2");
  });

  test("selected files list is empty when no files are selected", () => {
    const { container } = renderWithTheme(
      <SelectedFilesList
        files={[]}
        onRemoveFile={vi.fn()}
        t={t}
        totalSizeLabel="0 KB"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
