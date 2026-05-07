import type { Dispatch, SetStateAction } from "react";
import type { CapsuleLike, MainScreenProps } from "./MainScreenTypes";

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
};

export type DialogsProps = {
  activeImageSrc: string;
  activeSetLabel?: number;
  confirm: ConfirmState;
  filtersOpen: boolean;
  imageDialogOpen: boolean;
  interactionDisabled: boolean;
  isOverlay: boolean;
  nameDialog: NameDialogState;
  props: MainScreenProps;
  search: SearchState;
  share: ShareState;
  setConfirm: Dispatch<SetStateAction<ConfirmState>>;
  setFiltersOpen: (open: boolean) => void;
  setImageDialogOpen: (open: boolean) => void;
  setNameDialog: Dispatch<SetStateAction<NameDialogState>>;
  setSearch: Dispatch<SetStateAction<SearchState>>;
  setShare: Dispatch<SetStateAction<ShareState>>;
  onCloseRowMenu: () => void;
  onOpenCapsule?: (capsuleId: string) => Promise<void> | void;
};
