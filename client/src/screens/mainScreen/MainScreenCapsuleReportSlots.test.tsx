import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { MainScreenViewProps } from "./MainScreenViewTypes";
import {
  MainScreenFloatingCapsuleReportSlot,
  MainScreenInlineCapsuleReportSlot,
  capsuleWithFloatingReportSx,
} from "./MainScreenCapsuleReportSlots";

vi.mock("./CapsuleReportPanel", () => ({
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

function createProps() {
  return {
    activeCapsule: {
      id: "capsule-1",
      effective: { report: { verdict: { score: 0.9 } } },
    },
    isCapsuleReportPending: false,
    onDeleteCapsuleReport: vi.fn(),
    onGenerateCapsuleReport: vi.fn(),
  } as unknown as MainScreenViewProps["props"];
}

describe("MainScreenCapsuleReportSlots", () => {
  test("renders inline compact report and forwards actions", async () => {
    const user = userEvent.setup();
    const props = createProps();
    const onHighlightItemIds = vi.fn();

    render(
      <MainScreenInlineCapsuleReportSlot
        interactionDisabled={false}
        props={props}
        reportIsStale
        showFloatingReportInspector={false}
        showInlineCompactReport
        t={(key) => key}
        onHighlightItemIds={onHighlightItemIds}
      />,
    );

    expect(screen.getByTestId("compact-report")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "delete" }));
    await user.click(screen.getByRole("button", { name: "highlight" }));
    await user.click(screen.getByRole("button", { name: "regenerate" }));

    expect(props.onDeleteCapsuleReport).toHaveBeenCalledWith("capsule-1");
    expect(onHighlightItemIds).toHaveBeenCalledWith(["item-1"]);
    expect(props.onGenerateCapsuleReport).toHaveBeenCalledWith("capsule-1");
  });

  test("renders floating report only when requested", () => {
    const props = createProps();
    const { rerender } = render(
      <MainScreenFloatingCapsuleReportSlot
        interactionDisabled={false}
        props={props}
        reportIsStale={false}
        showFloatingReportInspector={false}
        showInlineCompactReport={false}
        t={(key) => key}
        onHighlightItemIds={vi.fn()}
      />,
    );

    expect(
      screen.queryByTestId("capsule-report-floating-inspector"),
    ).toBeNull();

    rerender(
      <MainScreenFloatingCapsuleReportSlot
        interactionDisabled={false}
        props={props}
        reportIsStale={false}
        showFloatingReportInspector
        showInlineCompactReport={false}
        t={(key) => key}
        onHighlightItemIds={vi.fn()}
      />,
    );

    const floatingInspector = screen.getByTestId(
      "capsule-report-floating-inspector",
    );
    expect(floatingInspector).toBeInTheDocument();
    expect(floatingInspector.parentElement).toBe(document.body);
    expect(capsuleWithFloatingReportSx.pr.lg).toContain("420px");
  });
});
