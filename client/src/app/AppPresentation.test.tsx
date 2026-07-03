import { afterEach, describe, expect, test, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import AppPresentation from "./AppPresentation";

const rootViewMock = vi.hoisted(() => vi.fn());
const routeContentMock = vi.hoisted(() => vi.fn());

vi.mock("./AppRouteContent", () => ({
  default: (props: Record<string, unknown>) => {
    routeContentMock(props);
    return <div data-testid="route-content">route</div>;
  },
}));

vi.mock("./AppRootView", () => ({
  default: (props: { routeContent: ReactNode }) => {
    rootViewMock(props);
    return <div data-testid="root-view">{props.routeContent}</div>;
  },
}));

describe("AppPresentation", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  test("passes grouped model slices to root and only route props to route content", () => {
    const model = {
      dialogs: { isShareDialogOpen: true },
      route: { appRoute: "capsule", routeOnly: "route" },
      shell: { appRoute: "capsule", shellOnly: "shell" },
      snackbars: { notificationOpen: false },
      theme: { palette: {} },
    };

    render(<AppPresentation model={model as never} />);

    expect(screen.getByTestId("root-view")).toBeInTheDocument();
    expect(routeContentMock).toHaveBeenCalledWith(model.route);
    expect(routeContentMock.mock.calls[0]?.[0]).not.toHaveProperty("shellOnly");
    expect(rootViewMock).toHaveBeenCalledWith(
      expect.objectContaining({
        dialogs: model.dialogs,
        shell: model.shell,
        snackbars: model.snackbars,
        theme: model.theme,
      }),
    );
    expect(rootViewMock.mock.calls[0]?.[0].routeContent).toBeTruthy();
  });
});
