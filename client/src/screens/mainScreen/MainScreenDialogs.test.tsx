import { useState } from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMainScreenProps,
  renderWithTheme,
  resetMainScreenTestMocks,
} from "./MainScreen.testUtils";
import MainScreenDialogs from "./MainScreenDialogs";

type DialogsProps = ComponentProps<typeof MainScreenDialogs>;
type ConfirmState = DialogsProps["confirm"];
type NameDialogState = DialogsProps["nameDialog"];
type SearchState = DialogsProps["search"];
type ShareState = DialogsProps["share"];

function DialogHarness({
  activeImageSrc = "",
  activeSetLabel = 1,
  initialConfirm = { action: "", capsuleId: "", outfitSetIndex: -1 },
  initialFiltersOpen = false,
  initialImageDialogOpen = false,
  initialNameDialog = { type: "", capsuleId: "", value: "" },
  initialSearch = { open: false, query: "", results: [], loading: false },
  initialShare = {
    open: false,
    url: "",
    expiresAt: null,
    name: "",
    copied: false,
    loading: false,
  },
  interactionDisabled = false,
  isOverlay = false,
  onCloseRowMenu = vi.fn(),
  propsOverrides = {},
}: {
  activeImageSrc?: string;
  activeSetLabel?: number;
  initialConfirm?: ConfirmState;
  initialFiltersOpen?: boolean;
  initialImageDialogOpen?: boolean;
  initialNameDialog?: NameDialogState;
  initialSearch?: SearchState;
  initialShare?: ShareState;
  interactionDisabled?: boolean;
  isOverlay?: boolean;
  onCloseRowMenu?: () => void;
  propsOverrides?: Partial<DialogsProps["props"]>;
}) {
  const [confirm, setConfirm] = useState(initialConfirm);
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [imageDialogOpen, setImageDialogOpen] = useState(
    initialImageDialogOpen,
  );
  const [nameDialog, setNameDialog] = useState(initialNameDialog);
  const [search, setSearch] = useState(initialSearch);
  const [share, setShare] = useState<ShareState>({
    loading: false,
    ...initialShare,
  });
  const props = createMainScreenProps(propsOverrides);

  return (
    <MainScreenDialogs
      activeImageSrc={activeImageSrc}
      activeSetLabel={activeSetLabel}
      confirm={confirm}
      filtersOpen={filtersOpen}
      imageDialogOpen={imageDialogOpen}
      interactionDisabled={interactionDisabled}
      isOverlay={isOverlay}
      nameDialog={nameDialog}
      props={props}
      search={search}
      share={share}
      setConfirm={setConfirm}
      setFiltersOpen={setFiltersOpen}
      setImageDialogOpen={setImageDialogOpen}
      setNameDialog={setNameDialog}
      setSearch={setSearch}
      setShare={setShare}
      onOpenCapsule={props.onOpenCapsule}
      onCloseRowMenu={onCloseRowMenu}
    />
  );
}

function renderDialogs(props: ComponentProps<typeof DialogHarness>) {
  return renderWithTheme(<DialogHarness {...props} />);
}

describe("MainScreenDialogs", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("closes mobile filters dialog through apply and reset actions", async () => {
    const user = userEvent.setup();
    const onApplyFilters = vi.fn(() => Promise.resolve());
    const onResetFilters = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialFiltersOpen: true,
      isOverlay: true,
      propsOverrides: { onApplyFilters, onResetFilters },
    });

    expect(screen.getAllByTestId("profile-filters-sidebar")).toHaveLength(1);
    await user.click(screen.getByText("apply-filters"));
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByTestId("profile-filters-sidebar"),
      ).not.toBeInTheDocument();
    });

    cleanup();
    renderDialogs({
      initialFiltersOpen: true,
      isOverlay: true,
      propsOverrides: { onApplyFilters, onResetFilters },
    });
    await user.click(screen.getByText("reset-filters"));
    expect(onResetFilters).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByTestId("profile-filters-sidebar"),
      ).not.toBeInTheDocument();
    });
  });

  test("closes rename dialog immediately and calls rename callback", async () => {
    const user = userEvent.setup();
    let resolveRename: (() => void) | undefined;
    const onRenameCapsule = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveRename = resolve;
        }),
    );
    renderDialogs({
      initialNameDialog: {
        type: "rename",
        capsuleId: "capsule-1",
        value: "Spring edit",
      },
      propsOverrides: { onRenameCapsule },
    });

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onRenameCapsule).toHaveBeenCalledWith("Spring edit", "capsule-1");
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename capsule" }),
      ).not.toBeInTheDocument();
    });
    resolveRename?.();
  });

  test("save-as dialog calls duplicate callback with entered name", async () => {
    const user = userEvent.setup();
    const onDuplicateCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialNameDialog: {
        type: "save-as",
        capsuleId: "capsule-1",
        value: "Spring copy",
      },
      propsOverrides: { onDuplicateCapsule },
    });

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onDuplicateCapsule).toHaveBeenCalledWith("Spring copy", "capsule-1");
  });

  test("updates and cancels name dialog without submitting", async () => {
    const user = userEvent.setup();
    const onRenameCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialNameDialog: {
        type: "rename",
        capsuleId: "capsule-1",
        value: "Spring edit",
      },
      propsOverrides: { onRenameCapsule },
    });

    await user.clear(screen.getByRole("textbox"));
    expect(screen.getByRole("button", { name: "OK" })).toBeDisabled();
    await user.type(screen.getByRole("textbox"), "Travel edit");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onRenameCapsule).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Rename capsule" }),
      ).not.toBeInTheDocument();
    });
  });

  test("runs regenerate and apply-filter confirm actions", async () => {
    const user = userEvent.setup();
    const onRefreshItems = vi.fn(() => Promise.resolve());
    const onApplyFilters = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: {
        action: "regenerate-all",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onRefreshItems, onApplyFilters },
    });

    expect(
      screen.getByText(
        "This will replace the current items in this capsule. Continue?",
      ),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Regenerate" }));
    expect(onRefreshItems).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Regenerate capsule?" }),
      ).not.toBeInTheDocument();
    });

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "regenerate-with-filter-changes",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onRefreshItems, onApplyFilters },
    });
    await user.click(
      screen.getByRole("button", { name: "Apply and regenerate" }),
    );
    expect(onApplyFilters).toHaveBeenCalledTimes(1);
  });

  test("runs image delete and row delete/revert confirm actions with explicit ids", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const onRevertCapsule = vi.fn(() => Promise.resolve());
    const onCloseRowMenu = vi.fn();
    renderDialogs({
      initialConfirm: {
        action: "delete-outfit-set-image",
        capsuleId: "",
        outfitSetIndex: 2,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteOutfitSetImage).toHaveBeenCalledWith(2);

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "delete-row",
        capsuleId: "capsule-2",
        outfitSetIndex: -1,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteCapsule).toHaveBeenCalledWith("capsule-2");
    expect(onCloseRowMenu).toHaveBeenCalledTimes(1);

    cleanup();
    renderDialogs({
      initialConfirm: {
        action: "revert-row",
        capsuleId: "capsule-2",
        outfitSetIndex: -1,
      },
      propsOverrides: {
        onDeleteOutfitSetImage,
        onDeleteCapsule,
        onRevertCapsule,
      },
      onCloseRowMenu,
    });
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(onRevertCapsule).toHaveBeenCalledWith("capsule-2");
    expect(onCloseRowMenu).toHaveBeenCalledTimes(2);
  });

  test("runs capsule-level delete and revert confirm actions", async () => {
    const user = userEvent.setup();
    const onDeleteCapsule = vi.fn(() => Promise.resolve());
    const onRevertCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: { action: "delete", capsuleId: "", outfitSetIndex: -1 },
      propsOverrides: { onDeleteCapsule, onRevertCapsule },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(onDeleteCapsule).toHaveBeenCalledWith();

    cleanup();
    renderDialogs({
      initialConfirm: { action: "revert", capsuleId: "", outfitSetIndex: -1 },
      propsOverrides: { onDeleteCapsule, onRevertCapsule },
    });
    await user.click(screen.getByRole("button", { name: "Revert" }));
    expect(onRevertCapsule).toHaveBeenCalledWith();
  });

  test("ignores image delete confirm without a valid outfit set index", async () => {
    const user = userEvent.setup();
    const onDeleteOutfitSetImage = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialConfirm: {
        action: "delete-outfit-set-image",
        capsuleId: "",
        outfitSetIndex: -1,
      },
      propsOverrides: { onDeleteOutfitSetImage },
    });

    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onDeleteOutfitSetImage).not.toHaveBeenCalled();
  });

  test("updates search dialog query, opens a result, and closes the dialog", async () => {
    const user = userEvent.setup();
    const onOpenCapsule = vi.fn(() => Promise.resolve());
    renderDialogs({
      initialSearch: {
        open: true,
        query: "spring",
        loading: true,
        results: [
          { id: "capsule-1", name: "Spring edit", status: "new" },
          { id: "capsule-2", name: "Earlier travel", status: "modified" },
        ],
      },
      propsOverrides: { onOpenCapsule },
    });

    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await user.clear(screen.getByPlaceholderText("Search capsules..."));
    await user.type(
      screen.getByPlaceholderText("Search capsules..."),
      "travel",
    );
    await user.click(screen.getByRole("button", { name: /Earlier travel/ }));

    expect(onOpenCapsule).toHaveBeenCalledWith("capsule-2");
    await waitFor(() => {
      expect(
        screen.queryByPlaceholderText("Search capsules..."),
      ).not.toBeInTheDocument();
    });
  });

  test("renders share dialog link and copies its URL", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    renderDialogs({
      initialShare: {
        open: true,
        url: "https://client.example/share/share-1",
        expiresAt: new Date(60_000).toISOString(),
        name: "Spring edit",
        copied: false,
        loading: false,
      },
    });

    expect(
      screen.getByRole("dialog", { name: "Share capsule" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Spring edit" })).toHaveAttribute(
      "href",
      "https://client.example/share/share-1",
    );
    await user.click(screen.getByRole("button", { name: "Copy share link" }));
    expect(writeText).toHaveBeenCalledWith(
      "https://client.example/share/share-1",
    );
  });

  test("opens and closes full-size outfit set image dialog", async () => {
    const user = userEvent.setup();
    renderDialogs({
      activeImageSrc: "data:image/png;base64,abc123",
      initialImageDialogOpen: true,
    });

    expect(screen.getByTestId("outfit-set-image-dialog")).toBeInTheDocument();
    expect(
      screen.getByTestId("outfit-set-image-dialog-paper"),
    ).toBeInTheDocument();
    expect(document.head.textContent).toContain(
      "background-color:transparent;box-shadow:none;",
    );
    await user.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => {
      expect(
        screen.queryByTestId("outfit-set-image-dialog"),
      ).not.toBeInTheDocument();
    });
  });
});
