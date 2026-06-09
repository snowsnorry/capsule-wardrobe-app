import {
  Alert,
  Box,
  Button,
  ButtonBase,
  IconButton,
  Stack,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import { useI18n } from "../i18n/useI18n";
import {
  OUTFIT_SET_IMAGE_ASPECT_RATIO,
  OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH,
} from "../screens/mainScreen/MainScreenHelpers";

type OutfitGeneratedImageBlockProps = {
  disabled: boolean;
  imageObsolete?: boolean;
  imageSrc: string;
  isPending: boolean;
  label: number | string;
  onDelete: () => void;
  onGenerate?: () => void;
  onImageClick: () => void;
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

export default function OutfitGeneratedImageBlock({
  disabled,
  imageObsolete = false,
  imageSrc,
  isPending,
  label,
  onDelete,
  onGenerate,
  onImageClick,
}: OutfitGeneratedImageBlockProps) {
  const { t } = useI18n();
  return (
    <Stack
      spacing={2}
      sx={{ pb: 2, px: { xs: 0.5, md: 1 }, alignItems: "center" }}
    >
      {imageSrc && imageObsolete ? (
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
      {isPending ? <OutfitImagePlaceholder /> : null}
      {!isPending && imageSrc ? (
        <Box
          sx={{
            maxWidth: `${OUTFIT_SET_IMAGE_PREVIEW_MAX_WIDTH}px`,
            position: "relative",
          }}
        >
          <IconButton
            aria-label={t("capsule.deleteOutfitSetImage")}
            disabled={disabled}
            onClick={onDelete}
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
              number: label,
            })}
            onClick={onImageClick}
            sx={outfitImagePreviewButtonSx}
          >
            <Box
              component="img"
              src={imageSrc}
              alt={t("capsule.outfitSetImageAlt", { number: label })}
              data-testid="outfit-set-image"
              sx={outfitImageSx}
            />
          </ButtonBase>
        </Box>
      ) : null}
      {!isPending && !imageSrc ? (
        <Button variant="outlined" disabled={disabled} onClick={onGenerate}>
          {t("capsule.createOutfitSetImage")}
        </Button>
      ) : null}
    </Stack>
  );
}
