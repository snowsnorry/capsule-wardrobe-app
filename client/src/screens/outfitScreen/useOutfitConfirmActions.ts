import { useState } from "react";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import { getOutfitItemKey } from "./outfitItemMappers";
import type { OutfitConfirmState } from "./OutfitConfirmDialog";
import type { OutfitScreenProps } from "./OutfitScreenTypes";

function useOutfitConfirmActions({
  activeOutfit,
  items,
  onDeleteOutfit,
  onDeleteOutfitImage,
  onRevertOutfit,
  replaceItems,
  selectedKeys,
  setSelectedKeys,
}: Pick<
  OutfitScreenProps,
  "activeOutfit" | "onDeleteOutfit" | "onDeleteOutfitImage" | "onRevertOutfit"
> & {
  items: OutfitItemSnapshot[];
  replaceItems: (nextItems: OutfitItemSnapshot[]) => void;
  selectedKeys: string[];
  setSelectedKeys: (keys: string[]) => void;
}) {
  const [confirmDialog, setConfirmDialog] = useState<OutfitConfirmState>({
    action: "",
    entry: null,
  });

  const removeEntry = (entry: OutfitItemSnapshot) => {
    setConfirmDialog({ action: "remove-item", entry });
  };

  const removeSelectedItems = () => {
    setConfirmDialog({ action: "remove-selected", entry: null });
  };

  const confirmOutfitAction = () => {
    if (confirmDialog.action === "remove-item") {
      const key = getOutfitItemKey(confirmDialog.entry);
      replaceItems(items.filter((item) => getOutfitItemKey(item) !== key));
    } else if (confirmDialog.action === "remove-selected") {
      replaceItems(
        items.filter((item) => !selectedKeys.includes(getOutfitItemKey(item))),
      );
      setSelectedKeys([]);
    } else if (confirmDialog.action === "delete") {
      void onDeleteOutfit(activeOutfit?.id);
    } else if (confirmDialog.action === "delete-image") {
      void onDeleteOutfitImage?.(activeOutfit?.id);
    } else if (confirmDialog.action === "revert") {
      void onRevertOutfit(activeOutfit?.id);
    }
    setConfirmDialog({ action: "", entry: null });
  };

  return {
    confirmDialog,
    confirmOutfitAction,
    removeEntry,
    removeSelectedItems,
    setConfirmDialog,
  };
}

export { useOutfitConfirmActions };
