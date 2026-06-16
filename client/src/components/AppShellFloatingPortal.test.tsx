import { Fragment, isValidElement } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import AppShellFloatingPortal from "./AppShellFloatingPortal";

afterEach(() => {
  vi.unstubAllGlobals();
  cleanup();
});

describe("AppShellFloatingPortal", () => {
  test("renders children into document body", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    render(
      <AppShellFloatingPortal>
        <span data-testid="floating-content">floating</span>
      </AppShellFloatingPortal>,
      { container },
    );

    const floatingContent = screen.getByTestId("floating-content");
    expect(floatingContent.parentElement).toBe(document.body);
    expect(container).not.toContainElement(floatingContent);
  });

  test("falls back to inline children without a document", () => {
    vi.stubGlobal("document", undefined);

    const fallback = AppShellFloatingPortal({
      children: <span>inline</span>,
    });

    expect(isValidElement(fallback)).toBe(true);
    expect(fallback.type).toBe(Fragment);
  });
});
