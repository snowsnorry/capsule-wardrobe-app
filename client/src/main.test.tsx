import React from "react";
import type { PropsWithChildren } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));
const appMock = vi.fn(() => null);
const localeProviderMock = vi.fn(({ children }: PropsWithChildren) => (
  <>{children}</>
));

vi.mock("react-dom/client", () => ({
  createRoot: createRootMock,
}));
vi.mock("./App", () => ({
  default: appMock,
}));
vi.mock("./i18n/LocaleProvider", () => ({
  LocaleProvider: localeProviderMock,
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
    await import("./main");

    expect(createRootMock).toHaveBeenCalledWith(
      document.getElementById("root"),
    );
    expect(renderMock).toHaveBeenCalledTimes(1);

    const tree = renderMock.mock.calls[0][0];
    const localeProvider = tree.props.children;
    const providerChildren = React.Children.toArray(
      localeProvider.props.children,
    );

    expect(tree.type).toBe(React.StrictMode);
    expect(localeProvider.type).toBe(localeProviderMock);
    expect(
      providerChildren.some(
        (child) => React.isValidElement(child) && child.type === appMock,
      ),
    ).toBe(true);
  });
});

describe("theme contract", () => {
  test("exports the expected palette factory, typography, and component defaults", async () => {
    const {
      appThemeTokens,
      createAppTheme,
      default: theme,
    } = await import("./theme");
    const darkTheme = createAppTheme("dark");
    const rootVars = theme.components.MuiCssBaseline.styleOverrides[
      ":root"
    ] as Record<string, string>;
    const darkRootVars = darkTheme.components.MuiCssBaseline.styleOverrides[
      ":root"
    ] as Record<string, string>;

    expect(theme.palette.primary.main).toBe("#1c7c7c");
    expect(theme.palette.background.default).toBe("#f7f4ef");
    expect(theme.palette.background.paper).toBe("#fffdf9");
    expect(theme.palette.success.main).toBe("#2f8f58");
    expect(darkTheme.palette.mode).toBe("dark");
    expect(darkTheme.palette.background.default).toBe("#101817");
    expect(appThemeTokens.radii.card).toBe("8px");
    expect(appThemeTokens.radii.panel).toBe("10px");
    expect(rootVars["--cw-color-primary"]).toBe(theme.palette.primary.main);
    expect(rootVars["--cw-radius-card"]).toBe(appThemeTokens.radii.card);
    expect(rootVars["--cw-color-product-image-wash"]).toBe("#f7f5f1");
    expect(rootVars["--cw-shadow-wardrobe-card"]).toBe(
      "0 0px 8px rgba(17, 36, 34, 0.08)",
    );
    expect(darkRootVars["--cw-color-primary"]).toBe(
      darkTheme.palette.primary.main,
    );
    expect(theme.typography.fontFamily).toContain("DM Sans");
    expect(theme.shape.borderRadius).toBe(18);
    expect(theme.components.MuiButton.defaultProps.disableElevation).toBe(true);
    expect(theme.components.MuiDialogActions.styleOverrides.root).toEqual(
      expect.objectContaining({
        backgroundColor: "transparent",
        justifyContent: "flex-end",
      }),
    );
    expect(
      theme.components.MuiCssBaseline.styleOverrides[
        "@keyframes placeholderShimmer"
      ],
    ).toBeDefined();
  });
});
