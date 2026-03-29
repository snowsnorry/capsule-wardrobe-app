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

import theme from "./theme.js";

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
    const themeProvider = localeProvider.props.children;
    const themeChildren = React.Children.toArray(themeProvider.props.children);

    expect(tree.type).toBe(React.StrictMode);
    expect(localeProvider.type).toBe(localeProviderMock);
    expect(themeProvider.props.theme).toBe(theme);
    expect(themeChildren.some((child) => child.type === appMock)).toBe(true);
  });
});

describe("theme contract", () => {
  test("exports the expected palette, typography, and component defaults", () => {
    expect(theme.palette.primary.main).toBe("#1c7c7c");
    expect(theme.palette.background.default).toBe("#f7f4ef");
    expect(theme.typography.fontFamily).toContain("DM Sans");
    expect(theme.shape.borderRadius).toBe(18);
    expect(theme.components.MuiButton.defaultProps.disableElevation).toBe(true);
    expect(theme.components.MuiCssBaseline.styleOverrides["@keyframes placeholderShimmer"]).toBeDefined();
  });
});
