import type { Dispatch, SetStateAction } from "react";
import type {
  CapsuleLike,
  MainScreenProps,
  ResolvedOutfitSet,
} from "./MainScreenTypes";

export type ConfirmState = {
  action: string;
  capsuleId: string;
  outfitSetIndex: number;
};

export type NameDialogState = {
  type: "rename" | "save-as" | "";
  capsuleId: string;
  value: string;
};

export type CopyOutfitDialogState = {
  open: boolean;
  value: string;
};

export type SearchState = {
  open: boolean;
  query: string;
  results: CapsuleLike[];
  loading: boolean;
};

export type ShareState = {
  open: boolean;
  url: string;
  expiresAt: string | Date | null;
  name: string;
  copied: boolean;
  loading: boolean;
  blockedReason?: "personal_uploaded_items" | null;
};

export type DialogsProps = {
  activeName: string;
  activeImageSrc: string;
  activeSet: ResolvedOutfitSet | null;
  activeSetLabel?: number;
  confirm: ConfirmState;
  filtersOpen: boolean;
  imageDialogOpen: boolean;
  interactionDisabled: boolean;
  isOverlay: boolean;
  copyOutfitDialog: CopyOutfitDialogState;
  nameDialog: NameDialogState;
  productDetailItem: MainScreenProps["items"][number] | null;
  props: MainScreenProps;
  search: SearchState;
  share: ShareState;
  setConfirm: Dispatch<SetStateAction<ConfirmState>>;
  setCopyOutfitDialog: Dispatch<SetStateAction<CopyOutfitDialogState>>;
  setFiltersOpen: (open: boolean) => void;
  setImageDialogOpen: (open: boolean) => void;
  setNameDialog: Dispatch<SetStateAction<NameDialogState>>;
  setProductDetailItem: (item: MainScreenProps["items"][number] | null) => void;
  setSearch: Dispatch<SetStateAction<SearchState>>;
  setShare: Dispatch<SetStateAction<ShareState>>;
  onCloseRowMenu: () => void;
  onCopyOutfitSuccess: (outfit: CapsuleLike) => void;
  onOpenCapsule?: (capsuleId: string) => Promise<void> | void;
};
