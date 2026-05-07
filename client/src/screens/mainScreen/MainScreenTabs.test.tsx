import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cleanup, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithTheme, resetMainScreenTestMocks } from "./MainScreen.testUtils";
import MainScreenTabs from "./MainScreenTabs";

const sets = [
  { id: "set-1", index: 0, label: 1, items: [], image: null, imageObsolete: false },
  { id: "set-2", index: 1, label: 2, items: [], image: null, imageObsolete: false }
];

describe("MainScreenTabs", () => {
  beforeEach(() => {
    resetMainScreenTestMocks();
  });

  afterEach(() => {
    cleanup();
  });

  test("shows overlay summary and changes active outfit set", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderWithTheme(
      <MainScreenTabs
        activeTab="all"
        disabled={false}
        isOverlay
        selectedCount={0}
        sets={sets}
        summary={["2 items", "2 outfits"]}
        onChange={onChange}
      />
    );

    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("2 outfits")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Outfit 2" }));

    expect(onChange).toHaveBeenCalledWith("set-2");
  });

  test("suppresses summary while selecting and ignores disabled tab changes", () => {
    const onChange = vi.fn();
    renderWithTheme(
      <MainScreenTabs
        activeTab="all"
        disabled
        isOverlay
        selectedCount={1}
        sets={sets}
        summary={["2 items"]}
        onChange={onChange}
      />
    );

    expect(screen.queryByText("2 items")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Outfit 1" })).toBeDisabled();

    expect(onChange).not.toHaveBeenCalled();
  });

  test("renders nothing when there are no outfit sets", () => {
    const { container } = renderWithTheme(
      <MainScreenTabs
        activeTab="all"
        disabled={false}
        isOverlay={false}
        selectedCount={0}
        sets={[]}
        summary={[]}
        onChange={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
