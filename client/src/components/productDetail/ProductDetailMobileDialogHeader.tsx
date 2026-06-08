import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { Box, DialogTitle, IconButton, Typography } from "@mui/material";
import { mobileCapsuleDialogTitleSx } from "../MobileDialogSurfaceStyles";
import { isSavedToWardrobe } from "../../utils/savedWardrobeState";
import ProductActionsMenu from "./ProductActionsMenu";
import {
  normalizeProductDetailItem,
  type ProductDetailItem,
} from "./ProductDetailModel";

type ProductDetailMobileDialogHeaderProps = {
  item: ProductDetailItem | null;
  onClose: () => void;
  onEditUploadedWardrobeItem?: (item: ProductDetailItem) => void;
  onRemoveFromPersonalItems?: (item: ProductDetailItem) => Promise<void> | void;
  onSetItemLike?: (
    item: ProductDetailItem,
    isLiked: boolean,
  ) => Promise<void> | void;
  onSaveToPersonalItems?: (item: ProductDetailItem) => Promise<void> | void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function ProductDetailMobileDialogHeader({
  item,
  onClose,
  onEditUploadedWardrobeItem,
  onRemoveFromPersonalItems,
  onSetItemLike,
  onSaveToPersonalItems,
  t,
}: ProductDetailMobileDialogHeaderProps) {
  const actionItem = normalizeProductDetailItem(item);
  const shouldShowActions = Boolean(
    actionItem &&
    (onSaveToPersonalItems ||
      onRemoveFromPersonalItems ||
      onSetItemLike ||
      onEditUploadedWardrobeItem),
  );
  const isSaved =
    isSavedToWardrobe(actionItem) ||
    Boolean(onRemoveFromPersonalItems && !onSaveToPersonalItems);

  return (
    <DialogTitle sx={mobileCapsuleDialogTitleSx}>
      <Typography
        component="span"
        variant="h6"
        sx={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap" }}
      >
        {t("search.productDetailsTitle")}
      </Typography>
      <Box
        sx={{
          alignItems: "center",
          display: "flex",
          flexShrink: 0,
          gap: 0.25,
          ml: "auto",
        }}
      >
        {shouldShowActions ? (
          <ProductActionsMenu
            item={actionItem}
            t={t}
            isSavedToWardrobe={isSaved}
            onEditUploadedWardrobeItem={onEditUploadedWardrobeItem}
            onRemoveFromPersonalItems={onRemoveFromPersonalItems}
            onSetItemLike={onSetItemLike}
            onSaveToPersonalItems={onSaveToPersonalItems}
          />
        ) : null}
        <IconButton aria-label={t("actions.close")} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Box>
    </DialogTitle>
  );
}

export default ProductDetailMobileDialogHeader;
