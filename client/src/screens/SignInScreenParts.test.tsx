import { createRef } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import {
  CodeStepForm,
  EmailStepForm,
  SignInHeader,
  SignInStatusMessages
} from "./SignInScreenParts";

vi.mock("../components/LocaleSwitcher", () => ({
  default: () => <div data-testid="locale-switcher" />
}));

const theme = createTheme();
const idleStatus = { loading: false, error: "", infoKey: "", infoParams: null };

function t(key: string, params?: Record<string, unknown>) {
  const labels = {
    appName: "Capsule",
    "auth.signInSubtitleCode": "Enter the code",
    "auth.signInWithPasskey": "Sign in with passkey",
    "auth.orEmailCode": "Or use email",
    "auth.emailLabel": "Email",
    "auth.emailPlaceholder": "person@example.com",
    "auth.sendCode": "Send code",
    "auth.emailCodeLabel": "Email code",
    "auth.emailCodePlaceholder": "123456",
    "auth.verify": "Verify",
    "auth.resendCode": "Resend code",
    "auth.changeEmail": "Change email",
    "auth.info": "Info {count}"
  };
  const label = labels[key] || key;
  return params
    ? label.replace(/\{(\w+)\}/g, (_, paramKey) => String(params[paramKey] ?? `{${paramKey}}`))
    : label;
}

function renderWithTheme(ui) {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe("SignInScreenParts", () => {
  afterEach(() => {
    cleanup();
  });

  test("header renders brand, locale switcher, and code subtitle", () => {
    renderWithTheme(<SignInHeader isMobile={false} step="code" t={t} />);

    expect(screen.getByText("Capsule")).toBeInTheDocument();
    expect(screen.getByTestId("locale-switcher")).toBeInTheDocument();
    expect(screen.getByText("Enter the code")).toBeInTheDocument();
  });

  test("email step disables submit until email is present and calls request handler", async () => {
    const onRequestCode = vi.fn((event) => event.preventDefault());
    const onEmailChange = vi.fn();
    const user = userEvent.setup();
    const googleButtonRef = createRef<HTMLDivElement>();
    const { rerender } = renderWithTheme(
      <EmailStepForm
        email=""
        status={idleStatus}
        googleClientId=""
        googleButtonRef={googleButtonRef}
        onEmailChange={onEmailChange}
        onRequestCode={onRequestCode}
        onPasskeySignIn={vi.fn()}
        t={t}
      />
    );

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    expect(screen.getByRole("button", { name: "Send code" })).toBeDisabled();

    await user.type(emailInput, "person@example.com");
    expect(onEmailChange).toHaveBeenCalled();
    rerender(
      <ThemeProvider theme={theme}>
        <EmailStepForm
          email="person@example.com"
          status={idleStatus}
          googleClientId=""
          googleButtonRef={googleButtonRef}
          onEmailChange={onEmailChange}
          onRequestCode={onRequestCode}
          onPasskeySignIn={vi.fn()}
          t={t}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole("button", { name: "Send code" })).not.toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Send code" }));
    expect(onRequestCode).toHaveBeenCalledTimes(1);
  });

  test("email step wires passkey sign-in action", async () => {
    const onPasskeySignIn = vi.fn();
    const user = userEvent.setup();

    renderWithTheme(
      <EmailStepForm
        email=""
        status={idleStatus}
        googleClientId=""
        googleButtonRef={createRef<HTMLDivElement>()}
        onEmailChange={vi.fn()}
        onRequestCode={vi.fn()}
        onPasskeySignIn={onPasskeySignIn}
        t={t}
      />
    );

    await user.click(screen.getByRole("button", { name: "Sign in with passkey" }));
    expect(onPasskeySignIn).toHaveBeenCalledTimes(1);
  });

  test("code step disables verify until code is present and wires resend/reset actions", async () => {
    const onRequestCode = vi.fn((event) => event.preventDefault());
    const onResetEmail = vi.fn();
    const onVerifyCode = vi.fn((event) => event.preventDefault());
    const onCodeChange = vi.fn();
    const user = userEvent.setup();
    let code = "";
    const { rerender } = renderWithTheme(
      <CodeStepForm
        code={code}
        status={idleStatus}
        onCodeChange={(value) => {
          code = value;
          onCodeChange(value);
        }}
        onRequestCode={onRequestCode}
        onVerifyCode={onVerifyCode}
        onResetEmail={onResetEmail}
        t={t}
      />
    );

    const codeInput = screen.getByRole("textbox", { name: /email code/i });
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();

    await user.type(codeInput, "654321");
    rerender(
      <ThemeProvider theme={theme}>
        <CodeStepForm
          code={code}
          status={idleStatus}
          onCodeChange={onCodeChange}
          onRequestCode={onRequestCode}
          onVerifyCode={onVerifyCode}
          onResetEmail={onResetEmail}
          t={t}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole("button", { name: "Verify" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Verify" }));
    await user.click(screen.getByRole("button", { name: "Resend code" }));
    await user.click(screen.getByRole("button", { name: "Change email" }));

    expect(onVerifyCode).toHaveBeenCalledTimes(1);
    expect(onRequestCode).toHaveBeenCalledTimes(1);
    expect(onResetEmail).toHaveBeenCalledTimes(1);
  });

  test("status messages render error and translated info", () => {
    renderWithTheme(
      <SignInStatusMessages
        status={{ loading: false, error: "Bad code", infoKey: "auth.info", infoParams: { count: 2 } }}
        t={t}
      />
    );

    expect(screen.getByText("Bad code")).toBeInTheDocument();
    expect(screen.getByText("Info 2")).toBeInTheDocument();
  });
});
