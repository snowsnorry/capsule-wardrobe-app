import { afterEach, describe, expect, test, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type { ComponentProps, MouseEvent } from "react";
import AppShellOutfitActionMenu from "./AppShellOutfitActionMenu";
import type { AppShellOutfitActionMenuController } from "./AppShellOutfitActionMenu";

vi.mock("../screens/mainScreen/CapsuleActionMenu", () => ({
  default: ({
    capsule,
    onClose,
    onDelete,
    onDownloadPdf,
    onDuplicate,
    onRename,
    onRevert,
    onSave,
    onShare,
    open,
  }: {
    capsule: { id?: string; name?: string; status?: string } | null;
    onClose: () => void;
    onDelete: () => void;
    onDownloadPdf: () => void;
    onDuplicate: () => void;
    onRename: () => void;
    onRevert: () => void;
    onSave: () => void;
    onShare: () => void;
    open: boolean;
  }) =>
    open ? (
      <div data-testid="mock-outfit-menu">
        <span data-testid="mock-outfit-menu-name">{capsule?.name}</span>
        <span data-testid="mock-outfit-menu-status">{capsule?.status}</span>
        <button type="button" onClick={onDownloadPdf}>
          download
        </button>
        <button type="button" onClick={onRename}>
          rename
        </button>
        <button type="button" onClick={onSave}>
          save
        </button>
        <button type="button" onClick={onShare}>
          share
        </button>
        <button type="button" onClick={onClose}>
          close
        </button>
        <button type="button" onClick={onDuplicate}>
          duplicate
        </button>
        <button type="button" onClick={onRevert}>
          revert
        </button>
        <button type="button" onClick={onDelete}>
          delete
        </button>
      </div>
    ) : null,
}));

vi.mock("../screens/mainScreen/MainScreenActionDialogs", () => ({
  ConfirmDialog: ({
    onCloseRowMenu,
    props,
    state,
  }: {
    onCloseRowMenu: () => void;
    props: {
      onDeleteCapsule: (id?: string) => Promise<void>;
      onRevertCapsule: (id?: string) => Promise<void>;
    };
    state: { action: string; capsuleId: string };
  }) =>
    state.action ? (
      <div data-testid="mock-confirm-dialog">
        <span>{state.action}</span>
        <button
          type="button"
          onClick={() => {
            if (state.action === "delete-row") {
              void props.onDeleteCapsule(state.capsuleId);
            }
            if (state.action === "revert-row") {
              void props.onRevertCapsule(state.capsuleId);
            }
            onCloseRowMenu();
          }}
        >
          confirm
        </button>
      </div>
    ) : null,
  NameDialog: ({
    props,
    state,
  }: {
    props: {
      onDuplicateCapsule: (name: string, id?: string) => Promise<void>;
      onRenameCapsule: (name: string, id?: string) => Promise<void>;
    };
    state: { type: string; capsuleId: string; value: string };
  }) =>
    state.type ? (
      <div data-testid="mock-name-dialog">
        <span>{state.value}</span>
        <button
          type="button"
          onClick={() => {
            if (state.type === "rename") {
              void props.onRenameCapsule("Renamed", state.capsuleId);
            }
            if (state.type === "save-as") {
              void props.onDuplicateCapsule("Copy", state.capsuleId);
            }
          }}
        >
          submit name
        </button>
      </div>
    ) : null,
}));

function renderMenu(
  overrides: Partial<ComponentProps<typeof AppShellOutfitActionMenu>> = {},
) {
  let controller: AppShellOutfitActionMenuController | null = null;
  const props = {
    activeOutfitMeta: {
      id: "outfit-1",
      name: "Active outfit",
      status: "modified",
    },
    disabled: false,
    isOverlay: false,
    onDeleteOutfit: vi.fn(async () => undefined),
    onDownloadOutfitPdf: vi.fn(async () => undefined),
    onDuplicateOutfit: vi.fn(async () => undefined),
    onRegisterController: vi.fn((next) => {
      controller = next;
    }),
    onRenameOutfit: vi.fn(async () => undefined),
    onRevertOutfit: vi.fn(async () => undefined),
    onSaveOutfit: vi.fn(async () => undefined),
    ...overrides,
  };
  const result = render(<AppShellOutfitActionMenu {...props} />);
  return { ...result, controller: () => controller, props };
}

function clickEventFor(element: HTMLElement) {
  return { currentTarget: element } as unknown as MouseEvent<HTMLElement>;
}

afterEach(() => {
  cleanup();
});

describe("AppShellOutfitActionMenu", () => {
  test("opens row actions with active outfit metadata merged into stale rows", async () => {
    const { controller, props } = renderMenu();
    const button = document.createElement("button");
    document.body.append(button);

    await waitFor(() => expect(controller()).not.toBeNull());
    act(() => {
      controller()?.openOutfitActions(clickEventFor(button), {
        id: "outfit-1",
        name: "Stale name",
        status: "saved",
      });
    });

    expect(screen.getByTestId("mock-outfit-menu-name")).toHaveTextContent(
      "Active outfit",
    );
    expect(screen.getByTestId("mock-outfit-menu-status")).toHaveTextContent(
      "modified",
    );

    fireEvent.click(screen.getByRole("button", { name: "download" }));
    fireEvent.click(screen.getByRole("button", { name: "save" }));
    fireEvent.click(screen.getByRole("button", { name: "share" }));

    expect(props.onDownloadOutfitPdf).toHaveBeenCalledWith("outfit-1");
    expect(props.onSaveOutfit).toHaveBeenCalledWith("outfit-1");
  });

  test("wires rename, duplicate, revert, and delete dialogs to outfit handlers", async () => {
    const { controller, props } = renderMenu({ activeOutfitMeta: null });
    const button = document.createElement("button");
    document.body.append(button);

    await waitFor(() => expect(controller()).not.toBeNull());
    act(() => {
      controller()?.openOutfitActions(clickEventFor(button), {
        id: "outfit-2",
        name: "Travel",
        status: "saved",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "rename" }));
    expect(screen.getByTestId("mock-name-dialog")).toHaveTextContent("Travel");
    fireEvent.click(screen.getByRole("button", { name: "submit name" }));
    expect(props.onRenameOutfit).toHaveBeenCalledWith("Renamed", "outfit-2");

    fireEvent.click(screen.getByRole("button", { name: "duplicate" }));
    fireEvent.click(screen.getByRole("button", { name: "submit name" }));
    expect(props.onDuplicateOutfit).toHaveBeenCalledWith("Copy", "outfit-2");

    fireEvent.click(screen.getByRole("button", { name: "revert" }));
    expect(screen.getByTestId("mock-confirm-dialog")).toHaveTextContent(
      "revert-row",
    );
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(props.onRevertOutfit).toHaveBeenCalledWith("outfit-2");
    expect(screen.queryByTestId("mock-outfit-menu")).not.toBeInTheDocument();

    act(() => {
      controller()?.openOutfitActions(clickEventFor(button), {
        id: "outfit-2",
        name: "Travel",
        status: "saved",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    fireEvent.click(screen.getByRole("button", { name: "close" }));
    expect(screen.queryByTestId("mock-outfit-menu")).not.toBeInTheDocument();

    act(() => {
      controller()?.openOutfitActions(clickEventFor(button), {
        id: "outfit-2",
        name: "Travel",
        status: "saved",
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "delete" }));
    fireEvent.click(screen.getByRole("button", { name: "confirm" }));
    expect(props.onDeleteOutfit).toHaveBeenCalledWith("outfit-2");
  });
});
