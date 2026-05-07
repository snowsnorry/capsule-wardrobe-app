import React from "react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import { LocaleProvider } from "../i18n/LocaleProvider";

const mediaQueryMock = vi.hoisted(() => vi.fn());
const localeSwitcherMock = vi.hoisted(() =>
  vi.fn(() => <div data-testid="locale-switcher" />),
);

vi.mock("@mui/material/useMediaQuery", () => ({
  default: mediaQueryMock,
}));
vi.mock("../components/LocaleSwitcher", () => ({
  default: localeSwitcherMock,
}));

import SignInScreen from "./SignInScreen";

const theme = createTheme();

type RenderHarnessOptions = {
  initialStep?: ComponentProps<typeof SignInScreen>["step"];
  initialEmail?: string;
  initialCode?: string;
  googleClientId?: string;
  status?: ComponentProps<typeof SignInScreen>["status"];
  onRequestCode?: ComponentProps<typeof SignInScreen>["onRequestCode"];
  onVerifyCode?: ComponentProps<typeof SignInScreen>["onVerifyCode"];
  onGoogleCredential?: ComponentProps<
    typeof SignInScreen
  >["onGoogleCredential"];
  onPasskeySignIn?: ComponentProps<typeof SignInScreen>["onPasskeySignIn"];
  onResetEmail?: ComponentProps<typeof SignInScreen>["onResetEmail"];
};

function renderHarness({
  initialStep = "email",
  initialEmail = "",
  initialCode = "",
  googleClientId = "",
  status = { loading: false, error: "", infoKey: "", infoParams: null },
  onRequestCode = vi.fn(),
  onVerifyCode = vi.fn(),
  onGoogleCredential = vi.fn(),
  onPasskeySignIn = vi.fn(),
  onResetEmail = vi.fn(),
}: RenderHarnessOptions = {}) {
  function Harness() {
    const [email, setEmail] = React.useState(initialEmail);
    const [code, setCode] = React.useState(initialCode);

    return (
      <SignInScreen
        step={initialStep}
        email={email}
        code={code}
        status={status}
        googleClientId={googleClientId}
        onEmailChange={setEmail}
        onCodeChange={setCode}
        onRequestCode={onRequestCode}
        onVerifyCode={onVerifyCode}
        onGoogleCredential={onGoogleCredential}
        onPasskeySignIn={onPasskeySignIn}
        onResetEmail={onResetEmail}
      />
    );
  }

  return {
    onRequestCode,
    onVerifyCode,
    onGoogleCredential,
    onPasskeySignIn,
    onResetEmail,
    ...render(
      <ThemeProvider theme={theme}>
        <LocaleProvider>
          <Harness />
        </LocaleProvider>
      </ThemeProvider>,
    ),
  };
}

describe("SignInScreen", () => {
  beforeEach(() => {
    mediaQueryMock.mockReset();
    mediaQueryMock.mockReturnValue(false);
    localeSwitcherMock.mockClear();
    vi.restoreAllMocks();
    document.head
      .querySelectorAll('script[src="https://accounts.google.com/gsi/client"]')
      .forEach((node) => node.remove());
    delete window.google;
  });

  afterEach(() => {
    cleanup();
  });

  test("shows progress indicator while sign-in is loading", () => {
    renderHarness({
      status: { loading: true, error: "", infoKey: "", infoParams: null },
    });

    expect(
      screen.getByRole("progressbar", { name: "Signing in" }),
    ).toBeInTheDocument();
  });

  test("hides progress indicator when sign-in is idle", () => {
    renderHarness();

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("loads google script and renders button when client id is present", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    const onGoogleCredential = vi.fn();
    const appendChildSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node) => {
        window.google = {
          accounts: {
            id: {
              initialize,
              renderButton,
            },
          },
        };
        queueMicrotask(() => {
          if (node instanceof HTMLScriptElement) {
            node.onload?.(new Event("load"));
          }
        });
        return node;
      });

    renderHarness({
      googleClientId: "client-id-123",
      onGoogleCredential,
    });

    await waitFor(() => {
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
      expect(initialize).toHaveBeenCalledWith({
        client_id: "client-id-123",
        callback: expect.any(Function),
      });
      expect(renderButton).toHaveBeenCalledWith(
        expect.any(HTMLDivElement),
        expect.objectContaining({
          locale: "en",
        }),
      );
    });

    const callback = initialize.mock.calls[0][0].callback as (response: {
      credential?: string | null;
    }) => void;
    callback({ credential: "  google-credential  " });
    expect(onGoogleCredential).toHaveBeenCalledWith("google-credential");
    callback({ credential: "   " });
    expect(onGoogleCredential).toHaveBeenCalledTimes(1);
  });

  test("uses an already available google identity client without adding a script", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    const appendChildSpy = vi.spyOn(document.head, "appendChild");
    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton,
        },
      },
    };

    renderHarness({ googleClientId: "client-id-123" });

    await waitFor(() => {
      expect(initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: "client-id-123",
        }),
      );
      expect(renderButton).toHaveBeenCalledTimes(1);
    });
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  test("waits for an existing google script element to load", async () => {
    const initialize = vi.fn();
    const renderButton = vi.fn();
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    document.head.appendChild(script);

    renderHarness({ googleClientId: "client-id-123" });

    window.google = {
      accounts: {
        id: {
          initialize,
          renderButton,
        },
      },
    };
    script.dispatchEvent(new Event("load"));

    await waitFor(() => {
      expect(initialize).toHaveBeenCalledTimes(1);
      expect(renderButton).toHaveBeenCalledTimes(1);
    });
  });

  test("skips google button setup outside the email step", () => {
    const appendChildSpy = vi.spyOn(document.head, "appendChild");

    renderHarness({
      initialStep: "code",
      initialEmail: "person@example.com",
      googleClientId: "client-id-123",
    });

    expect(screen.getByRole("textbox", { name: /code/i })).toBeInTheDocument();
    expect(appendChildSpy).not.toHaveBeenCalled();
  });

  test("google script load failure keeps email flow usable", async () => {
    const appendChildSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node) => {
        queueMicrotask(() => {
          if (node instanceof HTMLScriptElement) {
            node.onerror?.(new Event("error"));
          }
        });
        return node;
      });
    const user = userEvent.setup();

    renderHarness({
      googleClientId: "client-id-123",
    });

    await waitFor(() => {
      expect(appendChildSpy).toHaveBeenCalledTimes(1);
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    const sendCodeButton = screen.getByRole("button", { name: "Send code" });

    expect(sendCodeButton).toBeDisabled();
    await user.type(emailInput, "person@example.com");
    expect(sendCodeButton).not.toBeDisabled();
  });
});
