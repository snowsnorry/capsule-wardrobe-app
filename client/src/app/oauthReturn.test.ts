import { beforeEach, describe, expect, test, vi } from "vitest";
import { redirectToOAuthReturnIfPresent } from "./oauthReturn";

describe("oauth return bridge", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/");
  });

  test("redirects to same-origin oauth authorize return paths", () => {
    const assign = vi.fn();
    window.history.replaceState(
      {},
      "",
      `/?oauthReturnTo=${encodeURIComponent("/oauth/authorize?client_id=chatgpt&state=1")}`,
    );

    expect(redirectToOAuthReturnIfPresent(assign)).toBe(true);
    expect(assign).toHaveBeenCalledWith(
      "/oauth/authorize?client_id=chatgpt&state=1",
    );
  });

  test("ignores missing, cross-origin, and non-authorize return paths", () => {
    const assign = vi.fn();

    expect(redirectToOAuthReturnIfPresent(assign)).toBe(false);

    window.history.replaceState(
      {},
      "",
      `/?oauthReturnTo=${encodeURIComponent("https://evil.example/oauth/authorize")}`,
    );
    expect(redirectToOAuthReturnIfPresent(assign)).toBe(false);

    window.history.replaceState(
      {},
      "",
      `/?oauthReturnTo=${encodeURIComponent("/oauth/token")}`,
    );
    expect(redirectToOAuthReturnIfPresent(assign)).toBe(false);
    expect(assign).not.toHaveBeenCalled();
  });
});
