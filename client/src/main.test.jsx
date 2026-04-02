import React from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const appMock = vi.fn(() => null);
const localeProviderMock = vi.fn(({ children }) => <>{children}</>);

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock
}));
vi.mock("./App.jsx", () => ({
  default: appMock
}));
vi.mock("./i18n/LocaleProvider.jsx", () => ({
  LocaleProvider: localeProviderMock
}));

describe("main entrypoint", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockClear();
    createRootMock.mockClear();
    appMock.mockClear();
    localeProviderMock.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  test("renders the app tree into the root element", async () => {
    await import("./main.jsx");

    expect(createRootMock).toHaveBeenCalledWith(document.getElementById("root"));
    expect(renderMock).toHaveBeenCalledTimes(1);

    const tree = renderMock.mock.calls[0][0];
    const localeProvider = tree.props.children;
    const providerChildren = React.Children.toArray(localeProvider.props.children);

    expect(tree.type).toBe(React.StrictMode);
    expect(localeProvider.type).toBe(localeProviderMock);
    expect(providerChildren.some((child) => child.type === appMock)).toBe(true);
  });
});

describe("theme contract", () => {
  test("exports the expected palette factory, typography, and component defaults", async () => {
    const { createAppTheme, default: theme } = await import("./theme.js");
    const darkTheme = createAppTheme("dark");

    expect(theme.palette.primary.main).toBe("#1c7c7c");
    expect(theme.palette.background.default).toBe("#f7f4ef");
    expect(darkTheme.palette.mode).toBe("dark");
    expect(darkTheme.palette.background.default).toBe("#101817");
    expect(theme.typography.fontFamily).toContain("DM Sans");
    expect(theme.shape.borderRadius).toBe(18);
    expect(theme.components.MuiButton.defaultProps.disableElevation).toBe(true);
    expect(theme.components.MuiCssBaseline.styleOverrides["@keyframes placeholderShimmer"]).toBeDefined();
  });
});
