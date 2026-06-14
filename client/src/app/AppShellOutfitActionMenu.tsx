import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import CapsuleActionMenu from "../screens/mainScreen/CapsuleActionMenu";
import {
  ConfirmDialog,
  NameDialog,
} from "../screens/mainScreen/MainScreenActionDialogs";
import type {
  ConfirmState,
  NameDialogState,
} from "../screens/mainScreen/MainScreenDialogsTypes";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenProps,
} from "../screens/mainScreen/MainScreenTypes";
import type { OutfitMeta } from "./appTypes";

export type AppShellOutfitActionMenuController = {
  openOutfitActions: (
    event: MouseEvent<HTMLElement>,
    outfit: OutfitMeta,
  ) => void;
};

type AppShellOutfitActionMenuProps = {
  activeOutfitMeta: OutfitMeta | null;
  disabled: boolean;
  isOverlay: boolean;
  onDeleteOutfit: (outfitId?: string) => Promise<void>;
  onDownloadOutfitPdf: (outfitId?: string) => Promise<void>;
  onDuplicateOutfit: (name: string, outfitId?: string) => Promise<void>;
  onRegisterController: (
    controller: AppShellOutfitActionMenuController,
  ) => void;
  onRenameOutfit: (name: string, outfitId?: string) => Promise<void>;
  onRevertOutfit: (outfitId?: string) => Promise<void>;
  onSaveOutfit: (outfitId?: string) => Promise<void>;
};

type SidebarOutfitMenuState = {
  anchor: CapsuleMenuAnchor;
  outfit: CapsuleLike | null;
};

function makeNameDialog(
  type: "rename" | "save-as",
  outfit: CapsuleLike | null | undefined,
) {
  return {
    type,
    capsuleId: outfit?.id || "",
    value: outfit?.name || "",
  };
}

function useDialogProps({
  outfit,
  onDeleteOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onRenameOutfit,
  onRevertOutfit,
  onSaveOutfit,
}: {
  outfit: CapsuleLike | null;
  onDeleteOutfit: AppShellOutfitActionMenuProps["onDeleteOutfit"];
  onDownloadOutfitPdf: AppShellOutfitActionMenuProps["onDownloadOutfitPdf"];
  onDuplicateOutfit: AppShellOutfitActionMenuProps["onDuplicateOutfit"];
  onRenameOutfit: AppShellOutfitActionMenuProps["onRenameOutfit"];
  onRevertOutfit: AppShellOutfitActionMenuProps["onRevertOutfit"];
  onSaveOutfit: AppShellOutfitActionMenuProps["onSaveOutfit"];
}) {
  return useMemo(
    () =>
      ({
        activeCapsule: outfit,
        onDeleteCapsule: onDeleteOutfit,
        onDownloadPdf: onDownloadOutfitPdf,
        onDuplicateCapsule: onDuplicateOutfit,
        onRenameCapsule: onRenameOutfit,
        onRevertCapsule: onRevertOutfit,
        onSaveCapsule: onSaveOutfit,
        onShareCapsule: () => {},
        onApplyFilters: () => {},
        onDeleteOutfitSetImage: () => {},
        onRefreshItems: () => {},
      }) as unknown as MainScreenProps,
    [
      outfit,
      onDeleteOutfit,
      onDownloadOutfitPdf,
      onDuplicateOutfit,
      onRenameOutfit,
      onRevertOutfit,
      onSaveOutfit,
    ],
  );
}

function mergeActiveOutfit(
  outfit: OutfitMeta,
  activeOutfitMeta: OutfitMeta | null,
) {
  const isActive =
    String(outfit?.id || "") === String(activeOutfitMeta?.id || "");
  return isActive && activeOutfitMeta
    ? { ...outfit, ...activeOutfitMeta }
    : outfit;
}

function useRegisterOutfitActionMenuController({
  activeOutfitMeta,
  menuOutfitRef,
  onRegisterController,
  setMenu,
}: {
  activeOutfitMeta: OutfitMeta | null;
  menuOutfitRef: RefObject<CapsuleLike | null>;
  onRegisterController: AppShellOutfitActionMenuProps["onRegisterController"];
  setMenu: (state: SidebarOutfitMenuState) => void;
}) {
  useEffect(() => {
    onRegisterController({
      openOutfitActions: (event, outfit) => {
        const nextOutfit = mergeActiveOutfit(outfit, activeOutfitMeta);
        menuOutfitRef.current = nextOutfit;
        setMenu({ anchor: event.currentTarget, outfit: nextOutfit });
      },
    });
  }, [activeOutfitMeta, menuOutfitRef, onRegisterController, setMenu]);
}

function OutfitActionDialogs({
  clearMenu,
  confirm,
  dialogProps,
  disabled,
  isOverlay,
  nameDialog,
  setConfirm,
  setNameDialog,
}: {
  clearMenu: () => void;
  confirm: ConfirmState;
  dialogProps: MainScreenProps;
  disabled: boolean;
  isOverlay: boolean;
  nameDialog: NameDialogState;
  setConfirm: (state: ConfirmState) => void;
  setNameDialog: (state: NameDialogState) => void;
}) {
  return (
    <>
      <NameDialog
        state={nameDialog}
        copyPrefix="outfit"
        disabled={disabled}
        isOverlay={isOverlay}
        props={dialogProps}
        setState={setNameDialog}
      />
      <ConfirmDialog
        state={confirm}
        copyPrefix="outfit"
        disabled={disabled}
        isOverlay={isOverlay}
        props={dialogProps}
        setState={setConfirm}
        onCloseRowMenu={clearMenu}
      />
    </>
  );
}

function OutfitActionMenuList({
  disabled,
  menu,
  menuOutfitRef,
  onClose,
  onDownloadOutfitPdf,
  onSaveOutfit,
  setConfirm,
  setNameDialog,
}: {
  disabled: boolean;
  menu: SidebarOutfitMenuState;
  menuOutfitRef: RefObject<CapsuleLike | null>;
  onClose: () => void;
  onDownloadOutfitPdf: AppShellOutfitActionMenuProps["onDownloadOutfitPdf"];
  onSaveOutfit: AppShellOutfitActionMenuProps["onSaveOutfit"];
  setConfirm: (state: ConfirmState) => void;
  setNameDialog: (state: NameDialogState) => void;
}) {
  return (
    <CapsuleActionMenu
      anchorEl={menu.anchor}
      open={Boolean(menu.anchor)}
      onClose={onClose}
      capsule={menu.outfit}
      disabled={disabled}
      allowUnknownShareContent
      showShare={false}
      onDownloadPdf={() => void onDownloadOutfitPdf(menuOutfitRef.current?.id)}
      onRename={() => setNameDialog(makeNameDialog("rename", menu.outfit))}
      onRevert={() =>
        setConfirm({
          action: "revert-row",
          capsuleId: menuOutfitRef.current?.id || "",
          outfitSetIndex: -1,
        })
      }
      onSave={() => void onSaveOutfit(menuOutfitRef.current?.id)}
      onDuplicate={() => setNameDialog(makeNameDialog("save-as", menu.outfit))}
      onShare={() => {}}
      onDelete={() =>
        setConfirm({
          action: "delete-row",
          capsuleId: menuOutfitRef.current?.id || "",
          outfitSetIndex: -1,
        })
      }
    />
  );
}

export default function AppShellOutfitActionMenu({
  activeOutfitMeta,
  disabled,
  isOverlay,
  onDeleteOutfit,
  onDownloadOutfitPdf,
  onDuplicateOutfit,
  onRegisterController,
  onRenameOutfit,
  onRevertOutfit,
  onSaveOutfit,
}: AppShellOutfitActionMenuProps) {
  const [menu, setMenu] = useState<SidebarOutfitMenuState>({
    anchor: null,
    outfit: null,
  });
  const [nameDialog, setNameDialog] = useState<NameDialogState>({
    type: "",
    capsuleId: "",
    value: "",
  });
  const [confirm, setConfirm] = useState<ConfirmState>({
    action: "",
    capsuleId: "",
    outfitSetIndex: -1,
  });
  const menuOutfitRef = useRef<CapsuleLike | null>(null);
  const dialogProps = useDialogProps({
    outfit: menu.outfit,
    onDeleteOutfit,
    onDownloadOutfitPdf,
    onDuplicateOutfit,
    onRenameOutfit,
    onRevertOutfit,
    onSaveOutfit,
  });
  const closeMenu = () => setMenu((current) => ({ ...current, anchor: null }));
  const clearMenu = () => {
    menuOutfitRef.current = null;
    setMenu({ anchor: null, outfit: null });
  };
  useRegisterOutfitActionMenuController({
    activeOutfitMeta,
    menuOutfitRef,
    onRegisterController,
    setMenu,
  });

  return (
    <>
      <OutfitActionMenuList
        disabled={disabled}
        menu={menu}
        menuOutfitRef={menuOutfitRef}
        onClose={closeMenu}
        onDownloadOutfitPdf={onDownloadOutfitPdf}
        onSaveOutfit={onSaveOutfit}
        setConfirm={setConfirm}
        setNameDialog={setNameDialog}
      />
      <OutfitActionDialogs
        clearMenu={clearMenu}
        confirm={confirm}
        dialogProps={dialogProps}
        disabled={disabled}
        isOverlay={isOverlay}
        nameDialog={nameDialog}
        setConfirm={setConfirm}
        setNameDialog={setNameDialog}
      />
    </>
  );
}
