import { ConfirmDialog, NameDialog } from "./MainScreenActionDialogs";
import type { DialogsProps } from "./MainScreenDialogsTypes";
import { FiltersDialog, ImageDialog } from "./MainScreenMediaDialogs";
import { SearchDialog, ShareDialog } from "./MainScreenUtilityDialogs";
import ProductDetailDialog from "../../components/productDetail/ProductDetailDialog";

function MainScreenDialogs(props: DialogsProps) {
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
      <ProductDetailDialog
        item={props.productDetailItem}
        open={Boolean(props.productDetailItem)}
        isMobile={props.isOverlay}
        onClose={() => props.setProductDetailItem(null)}
        onRemoveFromMyWardrobe={props.props.onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={props.props.onSaveToMyWardrobe}
      />
    </>
  );
}

export default MainScreenDialogs;
