import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { createAppTheme } from "../../theme";
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
    showSettingsTitle,
    showFooterActions = true,
  }: {
    onApply: () => void;
    onReset: () => void;
    showSettingsTitle?: boolean;
    showFooterActions?: boolean;
  }) => (
    <div
      data-testid="profile-filters-sidebar"
      data-show-settings-title={String(showSettingsTitle)}
    >
      {showFooterActions ? (
        <>
          <button type="button" onClick={onReset}>
            reset-filters
          </button>
          <button type="button" onClick={onApply}>
            apply-filters
          </button>
        </>
      ) : null}
    </div>
  ),
  ProfileFiltersActions: ({
    onApply,
    onReset,
    showSettingsTitle,
  }: {
    onApply: () => void;
    onReset: () => void;
    showSettingsTitle?: boolean;
  }) => (
    <div
      data-testid="profile-filters-actions"
      data-show-settings-title={String(showSettingsTitle)}
    >
      <button type="button" onClick={onReset}>
        reset-filters
      </button>
      <button type="button" onClick={onApply}>
        apply-filters
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
        "capsule.settingsTitle": "Capsule settings",
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

  test("FiltersDialog renders the settings title in the mobile dialog header", () => {
    const props = {
      onApplyFilters: vi.fn(),
      onResetFilters: vi.fn(),
    };

    render(
      <FiltersDialog
        props={props as never}
        disabled={false}
        open
        isOverlay
        setOpen={vi.fn()}
      />,
    );

    expect(screen.getByText("Capsule settings")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Close filters" }),
    ).toBeInTheDocument();
    expect(screen.getByText("apply-filters").parentElement).toHaveAttribute(
      "data-show-settings-title",
      "false",
    );
  });

  test("FiltersDialog matches the capsule mobile header size and surfaces in dark mode", () => {
    const props = {
      onApplyFilters: vi.fn(),
      onResetFilters: vi.fn(),
    };
    const theme = createAppTheme("dark");

    render(
      <ThemeProvider theme={theme}>
        <FiltersDialog
          props={props as never}
          disabled={false}
          open
          isOverlay
          setOpen={vi.fn()}
        />
      </ThemeProvider>,
    );

    const header = screen
      .getByText("Capsule settings")
      .closest(".MuiDialogTitle-root");
    const content = screen
      .getByTestId("profile-filters-sidebar")
      .closest(".MuiDialogContent-root");
    const footer = screen
      .getByTestId("profile-filters-actions")
      .closest(".MuiDialogActions-root");

    expect(getComputedStyle(header!).paddingTop).toBe("12px");
    expect(getComputedStyle(header!).paddingBottom).toBe("8px");
    expect(getComputedStyle(header!).paddingLeft).toBe("16px");
    expect(getComputedStyle(header!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(header!).borderBottomWidth).toBe("");
    expect(getComputedStyle(content!).backgroundColor).toBe("rgb(16, 24, 23)");
    expect(getComputedStyle(content!).paddingTop).toBe("8px");
    expect(getComputedStyle(footer!).backgroundColor).toBe("rgb(21, 32, 31)");
    expect(getComputedStyle(footer!).justifyContent).toBe("flex-end");
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

  test("ImageDialog closes from empty preview space but not from the image", async () => {
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

    await user.click(screen.getByRole("img", { name: "Outfit set 2" }));
    expect(setOpen).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("outfit-set-image-dialog"));
    expect(setOpen).toHaveBeenCalledWith(false);

    setOpen.mockClear();
    render(
      <ImageDialog
        src="data:image/png;base64,abc"
        disabled
        open
        setOpen={setOpen}
      />,
    );

    await user.click(screen.getAllByTestId("outfit-set-image-dialog").at(-1)!);
    expect(setOpen).not.toHaveBeenCalled();
  });

  test("ImageDialog close button uses the media control theme token in dark mode", () => {
    render(
      <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
        <ImageDialog
          src="data:image/png;base64,abc"
          disabled={false}
          open
          setOpen={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByRole("button", { name: "Close" })).toHaveStyle({
      color: "var(--cw-color-media-control-ink)",
    });
  });
});
