import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import ColorSwatch from "./ColorSwatch";

const theme = createTheme();

function renderSwatch(value: string) {
  return render(
    <ThemeProvider theme={theme}>
      <ColorSwatch value={value} />
    </ThemeProvider>,
  );
}

describe("ColorSwatch", () => {
  afterEach(() => {
    cleanup();
  });

  test("keeps multicolor gradients inside a separate bordered shell", () => {
    const { container } = renderSwatch("multiple_accent_colors");
    const shell = container.querySelector('[aria-hidden="true"]');
    const fill = shell?.querySelector("span");

    expect(shell).toBeInstanceOf(HTMLElement);
    expect(fill).toBeInstanceOf(HTMLElement);
    expect(window.getComputedStyle(shell as Element).borderStyle).toBe("solid");
    expect(window.getComputedStyle(fill as Element).backgroundImage).toContain(
      "linear-gradient",
    );
  });
});
