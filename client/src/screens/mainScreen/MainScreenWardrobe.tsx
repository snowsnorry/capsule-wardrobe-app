import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Divider,
  IconButton,
  Stack,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ClothingCard from "../../components/ClothingCard";
import ClothingGridPlaceholder, {
  ClothingPlaceholderCard,
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../../components/ClothingGridPlaceholder";
import { useI18n } from "../../i18n/useI18n";
import {
  MAIN_SCREEN_CONTENT_COLUMN_SX,
  OUTFIT_SET_IMAGE_ASPECT_RATIO,
  OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH,
} from "./MainScreenHelpers";
import type {
  MainScreenItem,
  MobileCardColumns,
  ResolvedOutfitSet,
} from "./MainScreenTypes";
import type { ProductMenuPresentation } from "../../components/ClothingCardTypes";

type WardrobeProps = {
  activeImageSrc: string;
  activeSet: ResolvedOutfitSet | null;
  disabled: boolean;
  isImagePending: boolean;
  isLoading: boolean;
  isOverlay: boolean;
  mobileColumns: MobileCardColumns;
  partialPendingUrls: string[];
  selectedAnchorWardrobeItemIds: string[];
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
    options: { presentation: ProductMenuPresentation },
  ) => void;
  onProductClick: (item: MainScreenItem) => void;
  onToggleSelected: (item: MainScreenItem) => void;
};

function OutfitImagePlaceholder() {
  return (
    <Box
      data-testid="outfit-set-image-placeholder"
      sx={{
        width: "100%",
        aspectRatio: OUTFIT_SET_IMAGE_ASPECT_RATIO,
        background: "var(--cw-gradient-placeholder-image)",
        backgroundSize: "200% 100%",
        borderRadius: "var(--cw-radius-card)",
        animation: "placeholderShimmer 1.3s linear infinite",
      }}
    />
  );
}

const outfitImagePreviewButtonSx = {
  display: "block",
  maxWidth: "100%",
  borderRadius: "var(--cw-radius-card)",
  cursor: "zoom-in",
  p: 0,
  textAlign: "left",
  "&:focus-visible": {
    outline: "3px solid",
    outlineColor: "primary.main",
    outlineOffset: 3,
  },
} as const;

const outfitImageSx = {
  width: "auto",
  maxWidth: "100%",
  display: "block",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "var(--cw-radius-card)",
} as const;

function normalizePublicWardrobeId(value: unknown) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  const withoutPrefix = trimmed.replace(/^W/i, "");
  return /^\d+$/.test(withoutPrefix) ? `W${withoutPrefix}` : trimmed;
}

function isAnchorWardrobeItem(
  item: MainScreenItem,
  anchorWardrobeItemIds: string[],
) {
  const anchorIdSet = new Set(
    anchorWardrobeItemIds.map(normalizePublicWardrobeId).filter(Boolean),
  );
  if (anchorIdSet.size === 0) {
    return false;
  }

  return [item?.id, item?.wardrobeId]
    .map(normalizePublicWardrobeId)
    .some((itemId) => anchorIdSet.has(itemId));
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
              bgcolor: "var(--cw-color-media-control-bg)",
              color: "error.main",
            }}
          >
            <DeleteOutlineRoundedIcon />
          </IconButton>
          <ButtonBase
            aria-label={t("capsule.openOutfitSetImagePreview", {
              number: set.label,
            })}
            onClick={props.onImageClick}
            sx={outfitImagePreviewButtonSx}
          >
            <Box
              component="img"
              src={props.activeImageSrc}
              alt={t("capsule.outfitSetImageAlt", { number: set.label })}
              data-testid="outfit-set-image"
              sx={outfitImageSx}
            />
          </ButtonBase>
        </Box>
      ) : null}
      {!props.isImagePending && !props.activeImageSrc ? (
        <Button
          variant="outlined"
          disabled={props.disabled}
          onClick={() => props.onGenerateImage?.(set.index)}
        >
          {t("capsule.createOutfitSetImage")}
        </Button>
      ) : null}
    </Stack>
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
          props.selectedAnchorWardrobeItemIds,
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
