import { afterEach, describe, expect, test } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAppNavigation } from "./useAppNavigation";

function Harness() {
  const navigation = useAppNavigation();
  return (
    <div>
      <div data-testid="route">{navigation.appRoute}</div>
      <div data-testid="query">{navigation.searchInitialQuery}</div>
      <div data-testid="auto-open">
        {String(navigation.searchAutoOpenProductDetail)}
      </div>
      <div data-testid="share-id">{navigation.pendingShareId}</div>
      <button type="button" onClick={() => navigation.navigateApp("explore")}>
        explore
      </button>
      <button
        type="button"
        onClick={() =>
          navigation.navigateApp("explore", {
            query: "https://example.com/products/linen-shirt",
            openProductDetail: true,
          })
        }
      >
        product
      </button>
      <button
        type="button"
        onClick={() => navigation.navigateApp("statistics")}
      >
        statistics
      </button>
      <button type="button" onClick={() => navigation.navigateApp("capsule")}>
        capsule
      </button>
      <button type="button" onClick={() => navigation.clearShareRoute()}>
        clear-share
      </button>
      <button type="button" onClick={() => navigation.resetNavigation()}>
        reset
      </button>
    </div>
  );
}

describe("useAppNavigation", () => {
  afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
  });

  test.each([
    ["/explore", "explore"],
    ["/statistics", "statistics"],
  ])("initializes route state from %s", (path, route) => {
    window.history.replaceState({}, "", path);

    render(<Harness />);

    expect(screen.getByTestId("route")).toHaveTextContent(route);
  });

  test("navigates to product detail search state and clears it when leaving explore", () => {
    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "product" }));

    expect(window.location.pathname).toBe("/explore");
    expect(screen.getByTestId("route")).toHaveTextContent("explore");
    expect(screen.getByTestId("query")).toHaveTextContent(
      "https://example.com/products/linen-shirt",
    );
    expect(screen.getByTestId("auto-open")).toHaveTextContent("true");

    fireEvent.click(screen.getByRole("button", { name: "statistics" }));

    expect(window.location.pathname).toBe("/statistics");
    expect(screen.getByTestId("query")).toHaveTextContent("");
    expect(screen.getByTestId("auto-open")).toHaveTextContent("false");
  });

  test("clears and resets share route state", () => {
    window.history.replaceState({}, "", "/share/share-1");
    render(<Harness />);

    expect(screen.getByTestId("route")).toHaveTextContent("share");
    expect(screen.getByTestId("share-id")).toHaveTextContent("share-1");

    fireEvent.click(screen.getByRole("button", { name: "clear-share" }));

    expect(window.location.pathname).toBe("/");
    expect(screen.getByTestId("route")).toHaveTextContent("capsule");
    expect(screen.getByTestId("share-id")).toHaveTextContent("");

    fireEvent.click(screen.getByRole("button", { name: "explore" }));
    fireEvent.click(screen.getByRole("button", { name: "reset" }));
    expect(window.location.pathname).toBe("/");
    expect(screen.getByTestId("route")).toHaveTextContent("capsule");
  });
});
