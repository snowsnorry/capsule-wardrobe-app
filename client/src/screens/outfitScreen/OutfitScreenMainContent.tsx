import { Divider } from "@mui/material";
import OutfitGeneratedImageBlock from "../../components/OutfitGeneratedImageBlock";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { MobileCardColumns } from "../mainScreen/MainScreenTypes";
import { OutfitGrid } from "./OutfitGrid";
import { getOutfitItem } from "./outfitItemMappers";
import type { ItemMenuState, OutfitScreenProps } from "./OutfitScreenTypes";

type Translate = (key: string, params?: Record<string, unknown>) => string;

export type OutfitScreenMainContentProps = Pick<
  OutfitScreenProps,
  "activeOutfit" | "isContentBusy" | "isImagePending" | "onGenerateOutfitImage"
> & {
  highlightedReportItemKeys: string[];
  isMobile: boolean;
  isSelectionMode: boolean;
  mobileCardColumns: MobileCardColumns;
  onOpenImageDialog: () => void;
  onOpenItemMenu: (state: ItemMenuState) => void;
  onPreviewItem: (item: WardrobeItem | null) => void;
  onRequestDeleteImage: () => void;
  onToggleSelected: (key: string) => void;
  outfitImageSrc: string;
  selectedKeys: string[];
  showInlineCompactReport: boolean;
  showOutfitImageActions: boolean;
  t: Translate;
  visibleItems: OutfitItemSnapshot[];
};

export function OutfitScreenMainContent({
  activeOutfit,
  highlightedReportItemKeys,
  isContentBusy,
  isImagePending,
  isMobile,
  isSelectionMode,
  mobileCardColumns,
  onGenerateOutfitImage,
  onOpenImageDialog,
  onOpenItemMenu,
  onPreviewItem,
  onRequestDeleteImage,
  onToggleSelected,
  outfitImageSrc,
  selectedKeys,
  showInlineCompactReport,
  showOutfitImageActions,
  t,
  visibleItems,
}: OutfitScreenMainContentProps) {
  return (
    <>
      <OutfitGrid
        disabled={isContentBusy}
        highlightedKeys={highlightedReportItemKeys}
        isAfterCompactReport={showInlineCompactReport}
        isMobile={isMobile}
        isSelectionMode={isSelectionMode}
        mobileCardColumns={mobileCardColumns}
        selectedKeys={selectedKeys}
        visibleItems={visibleItems}
        t={t}
        onItemMenuOpen={(anchor, entry, options) =>
          onOpenItemMenu({
            anchor,
            entry,
            originRect: options.originRect,
            presentation: options.presentation,
          })
        }
        onPreviewItem={(entry) => onPreviewItem(getOutfitItem(entry))}
        onToggleSelected={onToggleSelected}
      />
      {showOutfitImageActions ? (
        <>
          <Divider data-testid="outfit-set-image-divider" flexItem />
          <OutfitGeneratedImageBlock
            disabled={isContentBusy}
            imageObsolete={Boolean(activeOutfit?.effective?.imageObsolete)}
            imageSrc={outfitImageSrc}
            isPending={isImagePending}
            label={1}
            onDelete={onRequestDeleteImage}
            onGenerate={() => void onGenerateOutfitImage?.(activeOutfit?.id)}
            onImageClick={onOpenImageDialog}
          />
        </>
      ) : null}
    </>
  );
}
