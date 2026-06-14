import { useMemo } from "react";
import type { MainScreenProps } from "../mainScreen/MainScreenTypes";
import type { OutfitScreenProps } from "./OutfitScreenTypes";

function useOutfitNameDialogProps({
  activeOutfit,
  onDeleteOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onRenameOutfit,
  onRevertOutfit,
  onSaveOutfit,
}: Pick<
  OutfitScreenProps,
  | "activeOutfit"
  | "onDeleteOutfit"
  | "onDownloadOutfitPdf"
  | "onDuplicateOutfit"
  | "onRenameOutfit"
  | "onRevertOutfit"
  | "onSaveOutfit"
>) {
  return useMemo(
    () =>
      ({
        activeCapsule: activeOutfit,
        onDeleteCapsule: onDeleteOutfit,
        onDownloadPdf: onDownloadOutfitPdf,
        onDuplicateCapsule: onDuplicateOutfit,
        onRenameCapsule: (name: string, outfitId?: string) =>
          onRenameOutfit(name.trim(), outfitId),
        onRevertCapsule: onRevertOutfit,
        onSaveCapsule: onSaveOutfit,
        onShareCapsule: () => {},
        onApplyFilters: () => {},
        onDeleteOutfitSetImage: () => {},
        onRefreshItems: () => {},
      }) as unknown as MainScreenProps,
    [
      activeOutfit,
      onDeleteOutfit,
      onDownloadOutfitPdf,
      onDuplicateOutfit,
      onRenameOutfit,
      onRevertOutfit,
      onSaveOutfit,
    ],
  );
}

export { useOutfitNameDialogProps };
