import { afterEach, describe, expect, test } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LocaleProvider } from "../i18n/LocaleProvider";
import LoadingScreen from "./LoadingScreen";

describe("LoadingScreen", () => {
  afterEach(cleanup);

  test("renders the localized session-checking state", () => {
    render(
      <LocaleProvider>
        <LoadingScreen />
      </LocaleProvider>
    );

    expect(screen.getByText("Checking session")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });
});
