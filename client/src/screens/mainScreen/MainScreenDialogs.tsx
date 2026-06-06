import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { UploadedWardrobeItemUpdatePayload } from "../../api/myWardrobe";
import { ConfirmDialog, NameDialog } from "./MainScreenActionDialogs";
import type { DialogsProps } from "./MainScreenDialogsTypes";
import { FiltersDialog, ImageDialog } from "./MainScreenMediaDialogs";
import { SearchDialog, ShareDialog } from "./MainScreenUtilityDialogs";
import { useI18n } from "../../i18n/useI18n";
import {
  getCanonicalItemUrl,
  patchLikedStateByUrl,
} from "../../utils/likedItemState";
import { isUploadedWardrobeItemNeedsReview } from "../../utils/uploadedWardrobeItemStatus";
import CapsuleProductDetailDialog from "./CapsuleProductDetailDialog";

type ProductDetailMode = "read" | "edit";

// eslint-disable-next-line max-lines-per-function
function MainScreenDialogs(props: DialogsProps) {
  const { t, locale } = useI18n();
  const [productDetailMode, setProductDetailMode] =
    useState<ProductDetailMode>("read");
  const productDetailKeyRef = useRef("");
  const productDetailKey = getProductDetailKey(props.productDetailItem);

  useEffect(() => {
    if (!productDetailKey) {
      productDetailKeyRef.current = "";
      setProductDetailMode("read");
      return;
    }

    if (productDetailKeyRef.current !== productDetailKey) {
      productDetailKeyRef.current = productDetailKey;
      setProductDetailMode(
        isUploadedWardrobeItemNeedsReview(props.productDetailItem)
          ? "edit"
          : "read",
      );
    }
  }, [productDetailKey, props.productDetailItem]);

  const closeProductDetail = () => {
    props.setProductDetailItem(null);
    setProductDetailMode("read");
  };
  const applyUploadedProductDetail = async (
    item: NonNullable<DialogsProps["productDetailItem"]>,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => {
    const updated = await props.props.onUpdateUploadedWardrobeItem?.(
      item,
      payload,
    );
    props.setProductDetailItem(updated || { ...item, ...payload });
    setProductDetailMode("read");
  };
  const setProductDetailItemLike = async (
    item: NonNullable<DialogsProps["productDetailItem"]>,
    isLiked: boolean,
  ) => {
    const itemUrl = getCanonicalItemUrl(item);
    if (!itemUrl) {
      return;
    }

    const previousItem = props.productDetailItem;
    props.setProductDetailItem(
      patchLikedStateByUrl(props.productDetailItem, itemUrl, isLiked),
    );
    try {
      await props.props.onSetItemLike?.(item, isLiked);
    } catch (error) {
      props.setProductDetailItem(previousItem);
      throw error;
    }
  };

  return (
    <>
      <NameDialog
        state={props.nameDialog}
        disabled={props.interactionDisabled}
        isOverlay={props.isOverlay}
        props={props.props}
        setState={props.setNameDialog}
      />
      <ConfirmDialog
        state={props.confirm}
        disabled={props.interactionDisabled}
        isOverlay={props.isOverlay}
        props={props.props}
        setState={props.setConfirm}
        onCloseRowMenu={props.onCloseRowMenu}
      />
      <SearchDialog
        state={props.search}
        disabled={props.interactionDisabled}
        isOverlay={props.isOverlay}
        setState={props.setSearch}
        onOpenCapsule={props.onOpenCapsule}
      />
      <FiltersDialog
        props={props.props}
        disabled={props.interactionDisabled}
        open={props.filtersOpen}
        isOverlay={props.isOverlay}
        setOpen={props.setFiltersOpen}
      />
      <ShareDialog
        state={props.share}
        isOverlay={props.isOverlay}
        setState={props.setShare}
      />
      <ImageDialog
        src={props.activeImageSrc}
        label={props.activeSetLabel}
        disabled={props.interactionDisabled}
        open={props.imageDialogOpen}
        setOpen={props.setImageDialogOpen}
      />
      <ProductDetailDialogSwitch
        item={props.productDetailItem}
        mode={productDetailMode}
        isMobile={props.isOverlay}
        locale={locale}
        t={t}
        onApply={applyUploadedProductDetail}
        onClose={closeProductDetail}
        onEdit={(item) => {
          props.setProductDetailItem(item);
          setProductDetailMode("edit");
        }}
        onReadMode={() => setProductDetailMode("read")}
        onRemoveFromMyWardrobe={props.props.onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={props.props.onSaveToMyWardrobe}
        onSetItemLike={setProductDetailItemLike}
      />
    </>
  );
}

function getProductDetailKey(item: DialogsProps["productDetailItem"]) {
  if (!item) {
    return "";
  }

  return String(item.id ?? item.url ?? "");
}

function ProductDetailDialogSwitch({
  item,
  isMobile,
  locale,
  mode,
  onApply,
  onClose,
  onEdit,
  onReadMode,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
  onSetItemLike,
  t,
}: {
  item: DialogsProps["productDetailItem"];
  isMobile: boolean;
  locale: string;
  mode: ProductDetailMode;
  onApply: (
    item: NonNullable<DialogsProps["productDetailItem"]>,
    payload: UploadedWardrobeItemUpdatePayload,
  ) => Promise<void> | void;
  onClose: () => void;
  onEdit: (item: NonNullable<DialogsProps["productDetailItem"]>) => void;
  onReadMode: () => void;
  onRemoveFromMyWardrobe?: DialogsProps["props"]["onRemoveFromMyWardrobe"];
  onSaveToMyWardrobe?: DialogsProps["props"]["onSaveToMyWardrobe"];
  onSetItemLike?: DialogsProps["props"]["onSetItemLike"];
  t: (key: string, params?: Record<string, unknown>) => string;
}): ReactElement {
  if (!item) {
    return <></>;
  }

  return (
    <CapsuleProductDetailDialog
      item={item}
      open={Boolean(item)}
      mode={mode}
      isMobile={isMobile}
      locale={locale}
      t={t}
      onApply={onApply}
      onClose={onClose}
      onEdit={onEdit}
      onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
      onReadMode={onReadMode}
      onSaveToMyWardrobe={onSaveToMyWardrobe}
      onSetItemLike={onSetItemLike}
    />
  );
}

export default MainScreenDialogs;
