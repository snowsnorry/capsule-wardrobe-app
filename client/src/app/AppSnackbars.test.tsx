import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import AppSnackbars from "./AppSnackbars";
import { testStatus } from "./testUtils";

function t(key: string) {
  return (
    {
      "notifications.prompt.action": "Enable",
      "notifications.prompt.message": "Get notified",
      "passkeys.add": "Add passkey",
      "passkeys.notNow": "Not now",
      "passkeys.prompt": "Secure your account",
    }[key] || key
  );
}

describe("AppSnackbars", () => {
  afterEach(cleanup);

  test("renders notification and passkey prompts with actions", () => {
    const onRequestNotificationPermission = vi.fn();
    const onAddPasskey = vi.fn();
    const onDismissPasskey = vi.fn();

    render(
      <AppSnackbars
        notificationOpen
        passkeyPrompt={{ open: true, loading: false }}
        status={testStatus}
        t={t}
        onRequestNotificationPermission={onRequestNotificationPermission}
        onAddPasskey={onAddPasskey}
        onDismissPasskey={onDismissPasskey}
        onClearError={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Enable" }));
    fireEvent.click(screen.getByRole("button", { name: "Add passkey" }));
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(screen.getByText("Get notified")).toBeInTheDocument();
    expect(screen.getByText("Secure your account")).toBeInTheDocument();
    expect(onRequestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(onAddPasskey).toHaveBeenCalledTimes(1);
    expect(onDismissPasskey).toHaveBeenCalledTimes(1);
  });

  test("renders error snackbar and disables passkey actions while loading", () => {
    const onClearError = vi.fn();

    render(
      <AppSnackbars
        notificationOpen={false}
        passkeyPrompt={{ open: true, loading: true }}
        status={{ ...testStatus, error: "Something failed" }}
        t={t}
        onRequestNotificationPermission={vi.fn()}
        onAddPasskey={vi.fn()}
        onDismissPasskey={vi.fn()}
        onClearError={onClearError}
      />,
    );

    expect(screen.getByText("Something failed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add passkey" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Not now" })).toBeDisabled();
  });

  test("renders prompts inside a dark theme", () => {
    render(
      <ThemeProvider theme={createTheme({ palette: { mode: "dark" } })}>
        <AppSnackbars
          notificationOpen
          passkeyPrompt={{ open: false, loading: false }}
          status={testStatus}
          t={t}
          onRequestNotificationPermission={vi.fn()}
          onAddPasskey={vi.fn()}
          onDismissPasskey={vi.fn()}
          onClearError={vi.fn()}
        />
      </ThemeProvider>,
    );

    expect(screen.getByText("Get notified")).toBeInTheDocument();
  });
});
