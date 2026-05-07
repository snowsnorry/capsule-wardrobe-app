import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AppDialogs from "./AppDialogs";
import { testStatus } from "./testUtils";

function t(key: string, params?: Record<string, unknown>) {
  const messages: Record<string, string> = {
    "actions.cancel": "Cancel",
    "capsule.shareImportBody": `Import ${String(params?.name || "")}?`,
    "capsule.shareImportConfirm": "Import",
    "capsule.shareImportTitle": "Import shared capsule",
    "dialogs.signOutBody": "You will need to sign in again.",
    "dialogs.signOutCancel": "Stay",
    "dialogs.signOutConfirm": "Sign out",
    "dialogs.signOutTitle": "Sign out?",
  };
  return messages[key] || key;
}

describe("AppDialogs", () => {
  afterEach(cleanup);

  test("renders share import dialog actions and blocks close while loading", () => {
    const onClearShareRoute = vi.fn();
    const onImportSharedCapsule = vi.fn();

    render(
      <AppDialogs
        isShareDialogOpen
        isShareLoading={false}
        shareMetadata={{ id: "share-1", name: "Spring edit" }}
        isSignOutConfirmOpen={false}
        status={testStatus}
        t={t}
        onClearShareRoute={onClearShareRoute}
        onImportSharedCapsule={onImportSharedCapsule}
        onCloseSignOutConfirm={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText("Import Spring edit?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(
      screen.getAllByRole("presentation")[0].firstChild as Element,
      { key: "Escape" },
    );

    expect(onImportSharedCapsule).toHaveBeenCalledTimes(1);
    expect(onClearShareRoute).toHaveBeenCalled();
  });

  test("renders sign-out dialog and disables actions while status is loading", () => {
    const onCloseSignOutConfirm = vi.fn();
    const onLogout = vi.fn();

    render(
      <AppDialogs
        isShareDialogOpen={false}
        isShareLoading={false}
        shareMetadata={null}
        isSignOutConfirmOpen
        status={{ ...testStatus, loading: true }}
        t={t}
        onClearShareRoute={vi.fn()}
        onImportSharedCapsule={vi.fn()}
        onCloseSignOutConfirm={onCloseSignOutConfirm}
        onLogout={onLogout}
      />,
    );

    expect(
      screen.getByText("You will need to sign in again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeDisabled();
    expect(onCloseSignOutConfirm).not.toHaveBeenCalled();
    expect(onLogout).not.toHaveBeenCalled();
  });

  test("closes the sign-out dialog through the dialog close handler when idle", () => {
    const onCloseSignOutConfirm = vi.fn();

    render(
      <AppDialogs
        isShareDialogOpen={false}
        isShareLoading={false}
        shareMetadata={null}
        isSignOutConfirmOpen
        status={testStatus}
        t={t}
        onClearShareRoute={vi.fn()}
        onImportSharedCapsule={vi.fn()}
        onCloseSignOutConfirm={onCloseSignOutConfirm}
        onLogout={vi.fn()}
      />,
    );

    fireEvent.keyDown(
      screen.getAllByRole("presentation")[0].firstChild as Element,
      { key: "Escape" },
    );

    expect(onCloseSignOutConfirm).toHaveBeenCalled();
  });
});
