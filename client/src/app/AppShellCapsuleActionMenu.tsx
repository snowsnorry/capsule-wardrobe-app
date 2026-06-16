import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import CapsuleActionMenu from "../screens/mainScreen/CapsuleActionMenu";
import {
  ConfirmDialog,
  NameDialog,
} from "../screens/mainScreen/MainScreenActionDialogs";
import { useShareCapsule } from "../screens/mainScreen/MainScreenShareHook";
import { ShareDialog } from "../screens/mainScreen/MainScreenUtilityDialogs";
import type {
  ConfirmState,
  NameDialogState,
} from "../screens/mainScreen/MainScreenDialogsTypes";
import type {
  CapsuleLike,
  CapsuleMenuAnchor,
  MainScreenProps,
} from "../screens/mainScreen/MainScreenTypes";
import type { CapsuleMeta } from "./appTypes";

export type AppShellCapsuleActionMenuController = {
  openCapsuleActions: (
    event: MouseEvent<HTMLElement>,
    capsule: CapsuleMeta,
  ) => void;
};

type AppShellCapsuleActionMenuProps = {
  activeCapsuleMeta: CapsuleMeta | null;
  disabled: boolean;
  isOverlay: boolean;
  onDeleteCapsule: (capsuleId?: string) => Promise<void>;
  onDownloadWardrobePdf: (capsuleId?: string) => Promise<void>;
  onDuplicateCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRegisterController: (
    controller: AppShellCapsuleActionMenuController,
  ) => void;
  onRenameCapsule: (name: string, capsuleId?: string) => Promise<void>;
  onRevertCapsule: (capsuleId?: string) => Promise<void>;
  onSaveCapsule: (capsuleId?: string) => Promise<void>;
  onSetCapsulePin: (
    capsuleId: string | undefined,
    pin: boolean,
  ) => Promise<void>;
  onShareCapsule: MainScreenProps["onShareCapsule"];
};

type SidebarCapsuleMenuState = {
  anchor: CapsuleMenuAnchor;
  capsule: CapsuleLike | null;
};

type ShellCapsuleMenuProps = {
  disabled: boolean;
  menu: SidebarCapsuleMenuState;
  menuCapsuleRef: RefObject<CapsuleLike | null>;
  onClose: () => void;
  onDelete: (state: ConfirmState) => void;
  onDownloadWardrobePdf: AppShellCapsuleActionMenuProps["onDownloadWardrobePdf"];
  onDuplicate: (state: NameDialogState) => void;
  onRename: (state: NameDialogState) => void;
  onRevert: (state: ConfirmState) => void;
  onSaveCapsule: AppShellCapsuleActionMenuProps["onSaveCapsule"];
  onSetCapsulePin: AppShellCapsuleActionMenuProps["onSetCapsulePin"];
  onShare: (capsule: CapsuleLike | null) => void;
};

function makeNameDialog(
  type: "rename" | "save-as",
  capsule: CapsuleLike | null | undefined,
) {
  return {
    type,
    capsuleId: capsule?.id || "",
    value: capsule?.name || "",
  };
}

function useMainScreenDialogProps({
  capsule,
  onDeleteCapsule,
  onDuplicateCapsule,
  onDownloadWardrobePdf,
  onRenameCapsule,
  onRevertCapsule,
  onSaveCapsule,
  onShareCapsule,
}: {
  capsule: CapsuleLike | null;
  onDeleteCapsule: AppShellCapsuleActionMenuProps["onDeleteCapsule"];
  onDuplicateCapsule: AppShellCapsuleActionMenuProps["onDuplicateCapsule"];
  onDownloadWardrobePdf: AppShellCapsuleActionMenuProps["onDownloadWardrobePdf"];
  onRenameCapsule: AppShellCapsuleActionMenuProps["onRenameCapsule"];
  onRevertCapsule: AppShellCapsuleActionMenuProps["onRevertCapsule"];
  onSaveCapsule: AppShellCapsuleActionMenuProps["onSaveCapsule"];
  onShareCapsule: AppShellCapsuleActionMenuProps["onShareCapsule"];
}) {
  return useMemo(
    () =>
      ({
        activeCapsule: capsule,
        onDeleteCapsule,
        onDownloadPdf: onDownloadWardrobePdf,
        onDuplicateCapsule,
        onRenameCapsule,
        onRevertCapsule,
        onSaveCapsule,
        onShareCapsule,
        onApplyFilters: () => {},
        onDeleteOutfitSetImage: () => {},
        onRefreshItems: () => {},
      }) as unknown as MainScreenProps,
    [
      capsule,
      onDeleteCapsule,
      onDownloadWardrobePdf,
      onDuplicateCapsule,
      onRenameCapsule,
      onRevertCapsule,
      onSaveCapsule,
      onShareCapsule,
    ],
  );
}

function mergeActiveCapsule(
  capsule: CapsuleMeta,
  activeCapsuleMeta: CapsuleMeta | null,
) {
  const isActive =
    String(capsule?.id || "") === String(activeCapsuleMeta?.id || "");
  return isActive && activeCapsuleMeta
    ? { ...capsule, ...activeCapsuleMeta }
    : capsule;
}

function useRegisterCapsuleActionMenuController({
  activeCapsuleMeta,
  menuCapsuleRef,
  onRegisterController,
  setMenu,
}: {
  activeCapsuleMeta: CapsuleMeta | null;
  menuCapsuleRef: RefObject<CapsuleLike | null>;
  onRegisterController: AppShellCapsuleActionMenuProps["onRegisterController"];
  setMenu: (state: SidebarCapsuleMenuState) => void;
}) {
  useEffect(() => {
    onRegisterController({
      openCapsuleActions: (event, capsule) => {
        const nextCapsule = mergeActiveCapsule(capsule, activeCapsuleMeta);
        menuCapsuleRef.current = nextCapsule;
        setMenu({ anchor: event.currentTarget, capsule: nextCapsule });
      },
    });
  }, [activeCapsuleMeta, menuCapsuleRef, onRegisterController, setMenu]);
}

function ShellCapsuleMenu({
  disabled,
  menu,
  menuCapsuleRef,
  onClose,
  onDelete,
  onDownloadWardrobePdf,
  onDuplicate,
  onRename,
  onRevert,
  onSaveCapsule,
  onSetCapsulePin,
  onShare,
}: ShellCapsuleMenuProps) {
  return (
    <CapsuleActionMenu
      anchorEl={menu.anchor}
      open={Boolean(menu.anchor)}
      onClose={onClose}
      capsule={menu.capsule}
      disabled={disabled}
      allowUnknownShareContent
      onDownloadPdf={() =>
        void onDownloadWardrobePdf(menuCapsuleRef.current?.id)
      }
      onRename={() =>
        onRename(makeNameDialog("rename", menuCapsuleRef.current))
      }
      onRevert={() =>
        onRevert({
          action: "revert-row",
          capsuleId: menuCapsuleRef.current?.id || "",
          outfitSetIndex: -1,
        })
      }
      onSave={() => void onSaveCapsule(menuCapsuleRef.current?.id)}
      onSetPin={(pin) => void onSetCapsulePin(menuCapsuleRef.current?.id, pin)}
      onDuplicate={() =>
        onDuplicate(makeNameDialog("save-as", menuCapsuleRef.current))
      }
      onShare={() => onShare(menuCapsuleRef.current)}
      onDelete={() =>
        onDelete({
          action: "delete-row",
          capsuleId: menuCapsuleRef.current?.id || "",
          outfitSetIndex: -1,
        })
      }
    />
  );
}

export default function AppShellCapsuleActionMenu({
  activeCapsuleMeta,
  disabled,
  isOverlay,
  onDeleteCapsule,
  onDownloadWardrobePdf,
  onDuplicateCapsule,
  onRegisterController,
  onRenameCapsule,
  onRevertCapsule,
  onSaveCapsule,
  onSetCapsulePin,
  onShareCapsule,
}: AppShellCapsuleActionMenuProps) {
  const [menu, setMenu] = useState<SidebarCapsuleMenuState>({
    anchor: null,
    capsule: null,
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
  const menuCapsuleRef = useRef<CapsuleLike | null>(null);
  const dialogProps = useMainScreenDialogProps({
    capsule: menu.capsule,
    onDeleteCapsule,
    onDownloadWardrobePdf,
    onDuplicateCapsule,
    onRenameCapsule,
    onRevertCapsule,
    onSaveCapsule,
    onShareCapsule,
  });
  const { share, setShare, shareCapsule } = useShareCapsule(
    dialogProps,
    disabled,
    menu.capsule?.name || "",
  );
  const closeMenu = () => setMenu((current) => ({ ...current, anchor: null }));
  const clearMenu = () => {
    menuCapsuleRef.current = null;
    setMenu({ anchor: null, capsule: null });
  };
  useRegisterCapsuleActionMenuController({
    activeCapsuleMeta,
    menuCapsuleRef,
    onRegisterController,
    setMenu,
  });

  return (
    <>
      <ShellCapsuleMenu
        disabled={disabled}
        menu={menu}
        menuCapsuleRef={menuCapsuleRef}
        onClose={closeMenu}
        onDelete={setConfirm}
        onDownloadWardrobePdf={onDownloadWardrobePdf}
        onDuplicate={setNameDialog}
        onRename={setNameDialog}
        onRevert={setConfirm}
        onSaveCapsule={onSaveCapsule}
        onSetCapsulePin={onSetCapsulePin}
        onShare={(capsule) => void shareCapsule(capsule, true)}
      />
      <NameDialog
        state={nameDialog}
        disabled={disabled}
        isOverlay={isOverlay}
        props={dialogProps}
        setState={setNameDialog}
      />
      <ConfirmDialog
        state={confirm}
        disabled={disabled}
        isOverlay={isOverlay}
        props={dialogProps}
        setState={setConfirm}
        onCloseRowMenu={clearMenu}
      />
      <ShareDialog state={share} isOverlay={isOverlay} setState={setShare} />
    </>
  );
}
