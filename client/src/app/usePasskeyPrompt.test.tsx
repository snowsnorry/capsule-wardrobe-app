import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { listPasskeys } from "../api/passkeys";
import { isPasskeySupported, registerPasskey } from "../auth/passkeys";
import { PASSKEY_PROMPT_DISMISSED_STORAGE_KEY } from "./appConstants";
import { usePasskeyPrompt } from "./usePasskeyPrompt";

vi.mock("../api/passkeys", () => ({
  listPasskeys: vi.fn(),
}));
vi.mock("../auth/passkeys", () => ({
  isPasskeySupported: vi.fn(),
  registerPasskey: vi.fn(),
}));

function Harness() {
  const prompt = usePasskeyPrompt(
    (error) => error?.message || "resolved",
    vi.fn(),
  );

  return (
    <div>
      <span data-testid="open">{String(prompt.passkeyPrompt.open)}</span>
      <span data-testid="loading">{String(prompt.passkeyPrompt.loading)}</span>
      <button type="button" onClick={() => prompt.maybeShowPasskeyPrompt()}>
        maybe
      </button>
      <button type="button" onClick={() => prompt.dismissPasskeyPrompt()}>
        dismiss
      </button>
      <button type="button" onClick={() => prompt.handleAddPasskeyFromPrompt()}>
        add
      </button>
    </div>
  );
}

describe("usePasskeyPrompt", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    vi.mocked(isPasskeySupported).mockReturnValue(true);
    vi.mocked(listPasskeys).mockResolvedValue({ passkeys: [] });
    vi.mocked(registerPasskey).mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  test("shows the prompt when passkeys are supported and none are registered", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "maybe" }));

    await waitFor(() => {
      expect(screen.getByTestId("open")).toHaveTextContent("true");
    });
    expect(listPasskeys).toHaveBeenCalledTimes(1);
  });

  test("skips the prompt when unsupported or dismissed", async () => {
    vi.mocked(isPasskeySupported).mockReturnValue(false);
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "maybe" }));

    await waitFor(() => {
      expect(listPasskeys).not.toHaveBeenCalled();
    });
  });

  test("dismisses and persists the prompt decision", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "maybe" }));
    await screen.findByText("true");
    fireEvent.click(screen.getByRole("button", { name: "dismiss" }));

    expect(screen.getByTestId("open")).toHaveTextContent("false");
    expect(
      window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY),
    ).toBe("true");
  });

  test("adds a passkey and suppresses future prompts", async () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => {
      expect(registerPasskey).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByTestId("open")).toHaveTextContent("false");
    expect(
      window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_STORAGE_KEY),
    ).toBe("true");
  });

  test("keeps the prompt open for actionable add-passkey failures", async () => {
    vi.mocked(registerPasskey).mockRejectedValue(new Error("passkey_failed"));
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "add" }));

    await waitFor(() => {
      expect(screen.getByTestId("open")).toHaveTextContent("true");
    });
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
  });
});
