import { Menu, MenuItem, ListItemIcon, ListItemText } from "@mui/material";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import CapsuleActionMenu from "./CapsuleActionMenu";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenItem,
  MainScreenProps,
  MobileCardColumns,
} from "./MainScreenTypes";

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

function MainScreenMenus(props: MenusProps) {
  const closeRowMenu = () => {
    props.setRowMenuAnchor(null);
    props.setRowMenuCapsule(null);
  };
  const closeProductMenu = () =>
    props.setProductMenu({ anchor: null, url: "", item: null });

  return (
    <>
      <CapsuleActionMenu
        anchorEl={props.headerMenuAnchor}
        open={Boolean(props.headerMenuAnchor)}
        onClose={() => props.setHeaderMenuAnchor(null)}
        capsule={props.props.activeCapsule}
        disabled={props.disabled}
        showRegenerateAll={false}
        onRegenerateAll={props.onRegenerateAll}
        onDownloadPdf={props.props.onDownloadPdf}
        onRename={() =>
          props.setNameDialog(
            makeNameDialog(
              "rename",
              props.props.activeCapsule,
              props.activeName,
            ),
          )
        }
        onRevert={() =>
          props.setConfirm({
            action: "revert",
            capsuleId: "",
            outfitSetIndex: -1,
          })
        }
        onSave={props.props.onSaveCapsule || (() => {})}
        onDuplicate={() =>
          props.setNameDialog(
            makeNameDialog("save-as", props.props.activeCapsule),
          )
        }
        onShare={() => props.onShareCapsule(props.props.activeCapsule)}
        showCardLayout={props.isOverlay}
        mobileCardColumns={props.mobileColumns}
        onMobileCardColumnsChange={props.onUpdateColumns}
        onDelete={() =>
          props.setConfirm({
            action: "delete",
            capsuleId: "",
            outfitSetIndex: -1,
          })
        }
      />
      <CapsuleActionMenu
        anchorEl={props.rowMenuAnchor}
        open={Boolean(props.rowMenuAnchor)}
        onClose={closeRowMenu}
        capsule={props.rowMenuCapsule}
        disabled={props.disabled}
        onDownloadPdf={() =>
          props.props.onDownloadPdf(props.rowMenuCapsule?.id)
        }
        onRename={() =>
          props.setNameDialog(makeNameDialog("rename", props.rowMenuCapsule))
        }
        onRevert={() =>
          props.setConfirm({
            action: "revert-row",
            capsuleId: props.rowMenuCapsule?.id || "",
            outfitSetIndex: -1,
          })
        }
        onSave={() => props.props.onSaveCapsule?.(props.rowMenuCapsule?.id)}
        onRegenerateAll={() => {}}
        onDuplicate={() =>
          props.setNameDialog(makeNameDialog("save-as", props.rowMenuCapsule))
        }
        onShare={() => props.onShareCapsule(props.rowMenuCapsule, true)}
        allowUnknownShareContent
        onDelete={() =>
          props.setConfirm({
            action: "delete-row",
            capsuleId: props.rowMenuCapsule?.id || "",
            outfitSetIndex: -1,
          })
        }
      />
      <Menu
        anchorEl={props.productMenu.anchor}
        open={Boolean(props.productMenu.anchor)}
        onClose={closeProductMenu}
      >
        <MenuItem
          onClick={() => {
            const item = props.productMenu.item;
            closeProductMenu();
            if (item) {
              props.setSelectionMode(true);
              props.props.onToggleRegenerationSelection(item);
            }
          }}
        >
          <ListItemIcon>
            <ThumbDownAltOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            {props.t("capsule.selectProductForRegeneration")}
          </ListItemText>
        </MenuItem>
        <MenuItem
          onClick={() => {
            const url = props.productMenu.url;
            closeProductMenu();
            void navigator.clipboard?.writeText(url);
          }}
        >
          {props.t("capsule.copyProductLinkAddress")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            const url = props.productMenu.url;
            closeProductMenu();
            if (url)
              props.props.onNavigateApp("explore", {
                query: url,
                openProductDetail: true,
              });
          }}
        >
          {props.t("capsule.showProductInfo")}
        </MenuItem>
      </Menu>
    </>
  );
}

export default MainScreenMenus;
