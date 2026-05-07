import type { MouseEvent } from "react";
import { Alert, Box, Button, Divider, IconButton, Stack } from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ClothingCard from "../../components/ClothingCard";
import ClothingGridPlaceholder, {
  ClothingPlaceholderCard,
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import { useI18n } from "../../i18n/useI18n";
import {
  OUTFIT_SET_IMAGE_ASPECT_RATIO,
  OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH,
} from "./MainScreenHelpers";
import type {
  MainScreenItem,
  MobileCardColumns,
  ResolvedOutfitSet,
} from "./MainScreenTypes";

type WardrobeProps = {
  activeImageSrc: string;
  activeSet: ResolvedOutfitSet | null;
  disabled: boolean;
  isImagePending: boolean;
  isLoading: boolean;
  isOverlay: boolean;
  mobileColumns: MobileCardColumns;
  partialPendingUrls: string[];
  selectedUrls: string[];
  selectionMode: boolean;
  showAdditionalItemPlaceholder: boolean;
  visibleItems: MainScreenItem[];
  onDeleteImage: (index: number) => void;
  onGenerateImage?: (index: number) => void;
  onImageClick: () => void;
  onProductMenuClick: (
    event: MouseEvent<HTMLButtonElement>,
    url: string,
    item: MainScreenItem,
  ) => void;
  onToggleSelected: (item: MainScreenItem) => void;
};

function OutfitImagePlaceholder() {
  return (
    <Box
      data-testid="outfit-set-image-placeholder"
      sx={{
        width: "100%",
        aspectRatio: OUTFIT_SET_IMAGE_ASPECT_RATIO,
        background:
          "linear-gradient(110deg, #ece8e2 8%, #f6f4f1 18%, #ece8e2 33%)",
        backgroundSize: "200% 100%",
        borderRadius: "8px",
        animation: "placeholderShimmer 1.3s linear infinite",
      }}
    />
  );
}

function OutfitImageBlock({ props }: { props: WardrobeProps }) {
  const { t } = useI18n();
  const set = props.activeSet;
  if (!set) return null;

  return (
    <Stack
      spacing={2}
      sx={{ pb: 2, px: { xs: 0.5, md: 1 }, alignItems: "center" }}
    >
      {set.image && set.imageObsolete ? (
        <Alert
          severity="warning"
          sx={{
            width: "100%",
            maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
          }}
        >
          {t("capsule.outfitSetImageObsolete")}
        </Alert>
      ) : null}
      {props.isImagePending ? <OutfitImagePlaceholder /> : null}
      {!props.isImagePending && props.activeImageSrc ? (
        <Box
          sx={{
            maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
            position: "relative",
          }}
        >
          <IconButton
            aria-label={t("capsule.deleteOutfitSetImage")}
            disabled={props.disabled}
            onClick={() => props.onDeleteImage(set.index)}
            sx={{
              position: "absolute",
              top: 12,
              right: 12,
              zIndex: 1,
              bgcolor: "rgba(255,255,255,0.9)",
              color: "error.main",
            }}
          >
            <DeleteOutlineRoundedIcon />
          </IconButton>
          <Box
            component="img"
            src={props.activeImageSrc}
            alt={`Outfit set ${set.label}`}
            data-testid="outfit-set-image"
            onClick={props.onImageClick}
            sx={{
              width: "auto",
              maxWidth: "100%",
              display: "block",
              border: "1px solid",
              borderColor: "divider",
              borderRadius: "8px",
              cursor: "zoom-in",
            }}
          />
        </Box>
      ) : null}
      {!props.isImagePending && !props.activeImageSrc ? (
        <Button
          variant="outlined"
          disabled={props.disabled}
          onClick={() => props.onGenerateImage?.(set.index)}
        >
          Create image
        </Button>
      ) : null}
    </Stack>
  );
}

function WardrobeGrid({ props }: { props: WardrobeProps }) {
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
            isSelectable={Boolean(itemUrl)}
            isSelected={props.selectedUrls.includes(itemUrl)}
            isSelectionMode={props.selectionMode}
            isRegenerating={props.disabled}
            onToggleSelected={props.onToggleSelected}
            onProductMenuClick={props.onProductMenuClick}
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
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
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
