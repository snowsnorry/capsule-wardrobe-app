import type { UploadedWardrobeItemUpdatePayload } from "../../api/personalItems";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";
import type {
  OutfitItemSnapshot,
  OutfitMeta,
  WardrobeItem,
} from "../../app/appTypes";

export type OutfitScreenProps = {
  activeOutfit: OutfitMeta | null;
  isContentBusy: boolean;
  isImagePending?: boolean;
  isReportPending?: boolean;
  onDeleteOutfit: (outfitId?: string) => Promise<void>;
  onDeleteOutfitImage?: (outfitId?: string) => Promise<void>;
  onDeleteOutfitReport?: (outfitId?: string) => Promise<void>;
  onDownloadOutfitPdf: (outfitId?: string) => Promise<void>;
  onDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  onGenerateOutfitImage?: (outfitId?: string) => Promise<void>;
  onGenerateOutfitReport?: (outfitId?: string) => Promise<void>;
  onRenameOutfit: (name: string, outfitId?: string) => Promise<void>;
  onReplaceOutfitItems: (
    outfitId: string,
    items: OutfitItemSnapshot[],
  ) => Promise<void>;
  onRemoveFromPersonalItems?: (item: WardrobeItem) => Promise<void>;
  onRevertOutfit: (outfitId?: string) => Promise<void>;
  onSaveToPersonalItems?: (item: WardrobeItem) => Promise<void>;
  onSaveOutfit: (outfitId?: string) => Promise<void>;
  onSetOutfitPin?: (
    outfitId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onSetItemLike: (item: WardrobeItem, isLiked: boolean) => Promise<void>;
  onUpdateUploadedWardrobeItem?: (
    item: WardrobeItem,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<WardrobeItem> | WardrobeItem;
};

export type ItemMenuState = {
  anchor: HTMLElement | null;
  entry: OutfitItemSnapshot | null;
  originRect?: ProductMenuOpenOptions["originRect"];
  presentation?: ProductMenuOpenOptions["presentation"];
};

export type ProductDetailMode = "read" | "edit";
