import { Box, Divider, Stack } from "@mui/material";
import ClothingCard from "../../components/ClothingCard";
import ClothingGridPlaceholder, {
  ClothingPlaceholderCard,
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import OutfitGeneratedImageBlock from "../../components/OutfitGeneratedImageBlock";
import { useI18n } from "../../i18n/useI18n";
import type { AnchorItemRef } from "../../components/ProfileFiltersSidebarTypes";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "./MainScreenHelpers";
import type {
  MainScreenItem,
  MobileCardColumns,
  ResolvedOutfitSet,
} from "./MainScreenTypes";
import type { ProductMenuOpenOptions } from "../../components/ClothingCardTypes";

type WardrobeProps = {
  activeImageSrc: string;
  activeSet: ResolvedOutfitSet | null;
  disabled: boolean;
  isImagePending: boolean;
  isLoading: boolean;
  isOverlay: boolean;
  mobileColumns: MobileCardColumns;
  partialPendingUrls: string[];
  selectedAnchorItemRefs: AnchorItemRef[];
  selectedUrls: string[];
  selectionMode: boolean;
  showAdditionalItemPlaceholder: boolean;
  visibleItems: MainScreenItem[];
  onDeleteImage: (index: number) => void;
  onGenerateImage?: (index: number) => void;
  onImageClick: () => void;
  onProductMenuOpen: (
    anchor: HTMLElement,
    url: string,
    item: MainScreenItem,
    options: ProductMenuOpenOptions,
  ) => void;
  onProductClick: (item: MainScreenItem) => void;
  onToggleSelected: (item: MainScreenItem) => void;
};

function isAnchorWardrobeItem(
  item: MainScreenItem,
  anchorItemRefs: AnchorItemRef[],
) {
  const itemUrl = String(item?.url || "").trim();
  const source = item?.source === "uploaded" ? "uploaded" : "from_catalog";
  const anchorRefSet = new Set(
    anchorItemRefs
      .map((ref) =>
        ref.url ? `${ref.source}\u0000${String(ref.url).trim()}` : "",
      )
      .filter(Boolean),
  );
  return Boolean(itemUrl && anchorRefSet.has(`${source}\u0000${itemUrl}`));
}

function OutfitImageBlock({ props }: { props: WardrobeProps }) {
  const set = props.activeSet;
  if (!set) return null;

  return (
    <OutfitGeneratedImageBlock
      disabled={props.disabled}
      imageObsolete={set.imageObsolete}
      imageSrc={props.activeImageSrc}
      isPending={props.isImagePending}
      label={set.label}
      onDelete={() => props.onDeleteImage(set.index)}
      onGenerate={() => props.onGenerateImage?.(set.index)}
      onImageClick={props.onImageClick}
    />
  );
}

function WardrobeGrid({ props }: { props: WardrobeProps }) {
  const { t } = useI18n();
  const columns = buildClothingGridTemplateColumns(props.mobileColumns);
  const gap = buildClothingGridGap(props.mobileColumns);

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: columns,
        gap,
        "@media (min-width: 1400px)": {
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        },
        "@media (min-width: 1760px)": {
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
        },
      }}
    >
      {props.visibleItems.map((item) => {
        const itemUrl = String(item?.url || "");
        const isAnchor = isAnchorWardrobeItem(
          item,
          props.selectedAnchorItemRefs,
        );
        const regenerationLockedReason = isAnchor
          ? t("capsule.anchorRegenerationLocked")
          : null;
        if (props.partialPendingUrls.includes(itemUrl)) {
          return (
            <ClothingPlaceholderCard
              key={`pending-${item.url || item.id}`}
              placeholderKey={`pending-${item.url || item.id}`}
              mobileColumns={props.mobileColumns}
            />
          );
        }
        return (
          <ClothingCard
            key={item.url || item.id}
            item={item}
            isSelectable={Boolean(itemUrl) && !isAnchor}
            isSelected={props.selectedUrls.includes(itemUrl)}
            isSelectionMode={props.selectionMode}
            isRegenerating={props.disabled}
            regenerationLockedReason={regenerationLockedReason}
            onToggleSelected={props.onToggleSelected}
            onProductClick={props.onProductClick}
            onProductMenuOpen={props.onProductMenuOpen}
            allowProductMenuWithoutUrl
            isMobile={props.isOverlay}
            mobileColumns={props.mobileColumns}
          />
        );
      })}
      {props.showAdditionalItemPlaceholder ? (
        <ClothingGridPlaceholder
          count={1}
          inline
          mobileColumns={props.mobileColumns}
        />
      ) : null}
    </Box>
  );
}

function MainScreenWardrobe(props: WardrobeProps) {
  const paddingX =
    props.mobileColumns === 1
      ? { xs: 1.25, sm: 2, md: 3 }
      : { xs: 0, sm: 2, md: 3 };

  return (
    <Box
      sx={{
        ...MAIN_SCREEN_CONTENT_COLUMN_SX,
        minHeight: 0,
        overflow: "visible",
        px: paddingX,
        pt: { xs: 1.25, md: 2 },
        pb: 2,
      }}
    >
      {props.isLoading ? (
        <ClothingGridPlaceholder
          count={12}
          mobileColumns={props.mobileColumns}
        />
      ) : (
        <Stack spacing={3} sx={{ minHeight: "100%" }}>
          <WardrobeGrid props={props} />
          {props.activeSet ? (
            <Divider data-testid="outfit-set-image-divider" flexItem />
          ) : null}
          <OutfitImageBlock props={props} />
        </Stack>
      )}
    </Box>
  );
}

export default MainScreenWardrobe;
