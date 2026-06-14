import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { OutfitScreenReportSlots } from "./OutfitScreenReportSlots";

vi.mock("./OutfitReportPanel", () => ({
  default: ({
    isCompact,
    onDelete,
    onHighlightItemIds,
    onRegenerate,
  }: {
    isCompact?: boolean;
    onDelete: () => void;
    onHighlightItemIds: (ids: string[]) => void;
    onRegenerate: () => void;
  }) => (
    <div data-testid={isCompact ? "compact-report" : "full-report"}>
      <button type="button" onClick={onDelete}>
        delete
      </button>
      <button type="button" onClick={() => onHighlightItemIds(["item-1"])}>
        highlight
      </button>
      <button type="button" onClick={onRegenerate}>
        regenerate
      </button>
    </div>
  ),
}));

afterEach(cleanup);

function createBaseProps() {
  return {
    activeOutfit: { id: "outfit-1", effective: { items: [], report: {} } },
    isContentBusy: false,
    isReportPending: false,
    onDeleteOutfitReport: vi.fn(),
    onGenerateOutfitReport: vi.fn(),
    onHighlightItemIds: vi.fn(),
    report: { verdict: { score: 0.8 } },
    reportIsStale: false,
    showFloatingReportInspector: false,
    showInlineCompactReport: false,
    t: (key: string) => key,
  };
}

describe("OutfitScreenReportSlots", () => {
  test("renders inline compact report and forwards actions", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();

    render(<OutfitScreenReportSlots {...props} showInlineCompactReport />);

    expect(screen.getByTestId("compact-report")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "delete" }));
    await user.click(screen.getByRole("button", { name: "highlight" }));
    await user.click(screen.getByRole("button", { name: "regenerate" }));

    expect(props.onDeleteOutfitReport).toHaveBeenCalledWith("outfit-1");
    expect(props.onHighlightItemIds).toHaveBeenCalledWith(["item-1"]);
    expect(props.onGenerateOutfitReport).toHaveBeenCalledWith("outfit-1");
  });

  test("renders floating report only when requested", async () => {
    const user = userEvent.setup();
    const props = createBaseProps();
    const { rerender } = render(<OutfitScreenReportSlots {...props} />);

    expect(screen.queryByTestId("outfit-report-floating-inspector")).toBeNull();

    rerender(
      <OutfitScreenReportSlots {...props} showFloatingReportInspector />,
    );

    expect(
      screen.getByTestId("outfit-report-floating-inspector"),
    ).toBeInTheDocument();
    const floatingReport = within(screen.getByTestId("full-report"));

    await user.click(floatingReport.getByRole("button", { name: "delete" }));
    await user.click(floatingReport.getByRole("button", { name: "highlight" }));
    await user.click(
      floatingReport.getByRole("button", { name: "regenerate" }),
    );

    expect(props.onDeleteOutfitReport).toHaveBeenCalledWith("outfit-1");
    expect(props.onHighlightItemIds).toHaveBeenCalledWith(["item-1"]);
    expect(props.onGenerateOutfitReport).toHaveBeenCalledWith("outfit-1");
  });
});
