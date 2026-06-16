import CapsuleActionMenu from "./CapsuleActionMenu";
import ProductMenu from "./MainScreenProductMenu";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenItem,
  MainScreenProps,
  MobileCardColumns,
} from "./MainScreenTypes";
import type {
  MobileContextMenuOriginRect,
  ProductMenuPresentation,
} from "../../components/ClothingCardTypes";

type NameDialogState = {
  type: "rename" | "save-as" | "";
  capsuleId: string;
  value: string;
};
type ConfirmState = {
  action: string;
  capsuleId: string;
  outfitSetIndex: number;
};
type ProductMenuState = {
  anchor: CapsuleMenuAnchor;
  url: string;
  item: MainScreenItem | null;
  originRect?: MobileContextMenuOriginRect;
  presentation?: ProductMenuPresentation;
};

type MenusProps = {
  activeName: string;
  disabled: boolean;
  headerMenuAnchor: CapsuleMenuAnchor;
  isOverlay: boolean;
  mobileColumns: MobileCardColumns;
  productMenu: ProductMenuState;
  props: MainScreenProps;
  rowMenuAnchor: CapsuleMenuAnchor;
  rowMenuCapsule: CapsuleLike | null;
  setConfirm: (state: ConfirmState) => void;
  setHeaderMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setNameDialog: (state: NameDialogState) => void;
  setProductMenu: (state: ProductMenuState) => void;
  setRowMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setRowMenuCapsule: (capsule: CapsuleLike | null) => void;
  setSelectionMode: (value: boolean) => void;
  onRegenerateAll: () => void;
  onShareCapsule: (
    capsule?: CapsuleLike | null,
    allowUnknownContent?: boolean,
  ) => void;
  onUpdateColumns: (value: MobileCardColumns) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
};

function makeNameDialog(
  type: "rename" | "save-as",
  capsule: CapsuleLike | null | undefined,
  fallback = "",
) {
  return {
    type,
    capsuleId: capsule?.id || "",
    value: capsule?.name || fallback,
  };
}

function HeaderCapsuleMenu({ menuProps }: { menuProps: MenusProps }) {
  const activeCapsuleHasReport = Boolean(
    menuProps.props.activeCapsule?.effective?.report,
  );
  const canAnalyzeActiveCapsule = Boolean(
    menuProps.props.activeCapsule?.id && menuProps.props.items.length > 0,
  );

  return (
    <CapsuleActionMenu
      anchorEl={menuProps.headerMenuAnchor}
      open={Boolean(menuProps.headerMenuAnchor)}
      onClose={() => menuProps.setHeaderMenuAnchor(null)}
      capsule={menuProps.props.activeCapsule}
      disabled={menuProps.disabled}
      showAnalyze={menuProps.isOverlay && !activeCapsuleHasReport}
      canAnalyze={canAnalyzeActiveCapsule}
      onAnalyze={() =>
        menuProps.props.onGenerateCapsuleReport?.(
          menuProps.props.activeCapsule?.id,
        )
      }
      showRegenerateAll={false}
      onRegenerateAll={menuProps.onRegenerateAll}
      onDownloadPdf={menuProps.props.onDownloadPdf}
      onRename={() =>
        menuProps.setNameDialog(
          makeNameDialog(
            "rename",
            menuProps.props.activeCapsule,
            menuProps.activeName,
          ),
        )
      }
      onRevert={() =>
        menuProps.setConfirm({
          action: "revert",
          capsuleId: "",
          outfitSetIndex: -1,
        })
      }
      onSave={menuProps.props.onSaveCapsule || (() => {})}
      onSetPin={(pin) =>
        void menuProps.props.onSetCapsulePin?.(
          menuProps.props.activeCapsule?.id,
          pin,
        )
      }
      onDuplicate={() =>
        menuProps.setNameDialog(
          makeNameDialog("save-as", menuProps.props.activeCapsule),
        )
      }
      onShare={() => menuProps.onShareCapsule(menuProps.props.activeCapsule)}
      showCardLayout={menuProps.isOverlay}
      mobileCardColumns={menuProps.mobileColumns}
      onMobileCardColumnsChange={menuProps.onUpdateColumns}
      onDelete={() =>
        menuProps.setConfirm({
          action: "delete",
          capsuleId: "",
          outfitSetIndex: -1,
        })
      }
    />
  );
}

function RowCapsuleMenu({
  closeRowMenu,
  menuProps,
}: {
  closeRowMenu: () => void;
  menuProps: MenusProps;
}) {
  return (
    <CapsuleActionMenu
      anchorEl={menuProps.rowMenuAnchor}
      open={Boolean(menuProps.rowMenuAnchor)}
      onClose={closeRowMenu}
      capsule={menuProps.rowMenuCapsule}
      disabled={menuProps.disabled}
      onDownloadPdf={() =>
        menuProps.props.onDownloadPdf(menuProps.rowMenuCapsule?.id)
      }
      onRename={() =>
        menuProps.setNameDialog(
          makeNameDialog("rename", menuProps.rowMenuCapsule),
        )
      }
      onRevert={() =>
        menuProps.setConfirm({
          action: "revert-row",
          capsuleId: menuProps.rowMenuCapsule?.id || "",
          outfitSetIndex: -1,
        })
      }
      onSave={() =>
        menuProps.props.onSaveCapsule?.(menuProps.rowMenuCapsule?.id)
      }
      onSetPin={(pin) =>
        void menuProps.props.onSetCapsulePin?.(
          menuProps.rowMenuCapsule?.id,
          pin,
        )
      }
      onRegenerateAll={() => {}}
      onDuplicate={() =>
        menuProps.setNameDialog(
          makeNameDialog("save-as", menuProps.rowMenuCapsule),
        )
      }
      onShare={() => menuProps.onShareCapsule(menuProps.rowMenuCapsule, true)}
      allowUnknownShareContent
      onDelete={() =>
        menuProps.setConfirm({
          action: "delete-row",
          capsuleId: menuProps.rowMenuCapsule?.id || "",
          outfitSetIndex: -1,
        })
      }
    />
  );
}

function MainScreenMenus(props: MenusProps) {
  const closeRowMenu = () => {
    props.setRowMenuAnchor(null);
    props.setRowMenuCapsule(null);
  };
  const closeProductMenu = () =>
    props.setProductMenu({ ...props.productMenu, anchor: null });

  return (
    <>
      <HeaderCapsuleMenu menuProps={props} />
      <RowCapsuleMenu closeRowMenu={closeRowMenu} menuProps={props} />
      <ProductMenu menuProps={props} onClose={closeProductMenu} t={props.t} />
    </>
  );
}

export default MainScreenMenus;
