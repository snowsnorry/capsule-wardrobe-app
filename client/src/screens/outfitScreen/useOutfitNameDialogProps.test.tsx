import { renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useOutfitNameDialogProps } from "./useOutfitNameDialogProps";

describe("useOutfitNameDialogProps", () => {
  test("adapts outfit actions to NameDialog's capsule-shaped props", async () => {
    const onDeleteOutfit = vi.fn();
    const onDownloadOutfitPdf = vi.fn();
    const onDuplicateOutfit = vi.fn();
    const onRenameOutfit = vi.fn();
    const onRevertOutfit = vi.fn();
    const onSaveOutfit = vi.fn();
    const { result } = renderHook(() =>
      useOutfitNameDialogProps({
        activeOutfit: { id: "outfit-1", name: "Office" },
        onDeleteOutfit,
        onDownloadOutfitPdf,
        onDuplicateOutfit,
        onRenameOutfit,
        onRevertOutfit,
        onSaveOutfit,
      }),
    );

    await result.current.onDeleteCapsule("outfit-1");
    await result.current.onDownloadPdf("outfit-1");
    await result.current.onDuplicateCapsule("Copy", "outfit-1");
    await result.current.onRenameCapsule("  Renamed  ", "outfit-1");
    await result.current.onRevertCapsule("outfit-1");
    await result.current.onSaveCapsule("outfit-1");
    await result.current.onShareCapsule();
    await result.current.onApplyFilters();

    expect(result.current.activeCapsule).toEqual({
      id: "outfit-1",
      name: "Office",
    });
    expect(onDeleteOutfit).toHaveBeenCalledWith("outfit-1");
    expect(onDownloadOutfitPdf).toHaveBeenCalledWith("outfit-1");
    expect(onDuplicateOutfit).toHaveBeenCalledWith("Copy", "outfit-1");
    expect(onRenameOutfit).toHaveBeenCalledWith("Renamed", "outfit-1");
    expect(onRevertOutfit).toHaveBeenCalledWith("outfit-1");
    expect(onSaveOutfit).toHaveBeenCalledWith("outfit-1");
  });
});
