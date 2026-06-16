import type { Dispatch, SetStateAction } from "react";
import type {
  MobileContextMenuOriginRect,
  ProductMenuPresentation,
} from "../../components/ClothingCardTypes";
import type {
  MainScreenDisplay,
  SearchState,
  ShareState,
} from "./MainScreenHooks";
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
  originRect?: MobileContextMenuOriginRect;
  presentation?: ProductMenuPresentation;
};

type InlineRenameState = {
  active: boolean;
  value: string;
  setValue: (value: string) => void;
  start: () => void;
  cancel: () => void;
  submit: () => Promise<void>;
};

export type MainScreenViewProps = {
  activeTab: string;
  confirm: ConfirmState;
  copiedOutfit: CapsuleLike | null;
  copyOutfitDialog: { open: boolean; value: string };
  display: MainScreenDisplay;
  filtersOpen: boolean;
  headerMenuAnchor: CapsuleMenuAnchor;
  imageDialogOpen: boolean;
  inlineRename: InlineRenameState;
  interactionDisabled: boolean;
  isOverlaySidebar: boolean;
  isReportInspectorLayout: boolean;
  locale: string;
  mobileColumns: MobileCardColumns;
  nameDialog: NameDialogState;
  productDetailItem: MainScreenItem | null;
  productMenu: ProductMenuState;
  props: MainScreenProps;
  requestRegenerateAll: () => void;
  isRegenerateAllDisabled: boolean;
  rowMenuAnchor: CapsuleMenuAnchor;
  rowMenuCapsule: CapsuleLike | null;
  search: SearchState;
  selectedCount: number;
  selectionMode: boolean;
  setActiveTab: (tab: string) => void;
  setConfirm: (state: ConfirmState) => void;
  setCopiedOutfit: (outfit: CapsuleLike | null) => void;
  setCopyOutfitDialog: Dispatch<
    SetStateAction<{ open: boolean; value: string }>
  >;
  setFiltersOpen: (open: boolean) => void;
  setHeaderMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setImageDialogOpen: (open: boolean) => void;
  setNameDialog: (state: NameDialogState) => void;
  setProductDetailItem: (item: MainScreenItem | null) => void;
  setProductMenu: (state: ProductMenuState) => void;
  setRowMenuAnchor: (anchor: CapsuleMenuAnchor) => void;
  setRowMenuCapsule: (capsule: CapsuleLike | null) => void;
  setSearch: Dispatch<SetStateAction<SearchState>>;
  setSelectionMode: (selected: boolean) => void;
  setShare: Dispatch<SetStateAction<ShareState>>;
  share: ShareState;
  shareCapsule: (
    capsule?: CapsuleLike | null,
    allowUnknownContent?: boolean,
  ) => void;
  t: (key: string, params?: Record<string, unknown>) => string;
  updateColumns: (value: MobileCardColumns) => void;
};
