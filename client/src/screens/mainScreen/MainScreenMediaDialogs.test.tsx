import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { FiltersDialog, ImageDialog } from "./MainScreenMediaDialogs";

vi.mock("@mui/material", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@mui/material")>();
  return {
    ...actual,
    Dialog: ({
      children,
      onClose,
      open,
    }: {
      children: ReactNode;
      onClose?: () => void;
      open: boolean;
    }) =>
      open ? (
        <div role="dialog">
          <button type="button" onClick={onClose}>
            mock-dialog-close
          </button>
          {children}
        </div>
      ) : null,
  };
});

vi.mock("../../components/ProfileFiltersSidebar", () => ({
  default: ({
    onApply,
    onReset,
  }: {
    onApply: () => void;
    onReset: () => void;
  }) => (
    <div>
      <button type="button" onClick={onApply}>
        apply-filters
      </button>
      <button type="button" onClick={onReset}>
        reset-filters
      </button>
    </div>
  ),
}));

vi.mock("../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        "actions.close": "Close",
        "capsule.closeFilters": "Close filters",
      })[key] || key,
  }),
}));

describe("MainScreenMediaDialogs", () => {
  afterEach(() => {
    cleanup();
  });

  test("FiltersDialog only closes from dialog onClose while interactions are enabled", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();
    const props = {
      onApplyFilters: vi.fn(),
      onResetFilters: vi.fn(),
    };

    render(
      <FiltersDialog
        props={props as never}
        disabled={false}
        open
        isOverlay={false}
        setOpen={setOpen}
      />,
    );

    await user.click(screen.getByRole("button", { name: "mock-dialog-close" }));
    expect(setOpen).toHaveBeenCalledWith(false);

    setOpen.mockClear();
    render(
      <FiltersDialog
        props={props as never}
        disabled
        open
        isOverlay={false}
        setOpen={setOpen}
      />,
    );

    await user.click(
      screen.getAllByRole("button", { name: "mock-dialog-close" }).at(-1)!,
    );
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("ImageDialog only closes from dialog onClose while interactions are enabled", async () => {
    const user = userEvent.setup();
    const setOpen = vi.fn();

    render(
      <ImageDialog
        src="data:image/png;base64,abc"
        label={2}
        disabled={false}
        open
        setOpen={setOpen}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Outfit set 2" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "mock-dialog-close" }));
    expect(setOpen).toHaveBeenCalledWith(false);

    setOpen.mockClear();
    render(<ImageDialog src="" disabled open setOpen={setOpen} />);

    await user.click(
      screen.getAllByRole("button", { name: "mock-dialog-close" }).at(-1)!,
    );
    expect(setOpen).not.toHaveBeenCalled();
  });
});
