import type { Dispatch, SetStateAction } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  IconButton,
  Link,
  LinearProgress,
  ListItemButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";
import ProfileFiltersSidebar from "../../components/ProfileFiltersSidebar";
import { useI18n } from "../../i18n/useI18n";
import { groupCapsules, highlightMatch } from "./MainScreenHelpers";
import type { CapsuleLike, MainScreenProps } from "./MainScreenTypes";

type ConfirmState = {
  action: string;
  capsuleId: string;
  outfitSetIndex: number;
};
type NameDialogState = {
  type: "rename" | "save-as" | "";
  capsuleId: string;
  value: string;
};
type SearchState = {
  open: boolean;
  query: string;
  results: CapsuleLike[];
  loading: boolean;
};
type ShareState = {
  open: boolean;
  url: string;
  expiresAt: string | Date | null;
  name: string;
  copied: boolean;
  loading: boolean;
};

type DialogsProps = {
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

function clearConfirm(setConfirm: DialogsProps["setConfirm"]) {
  setConfirm({ action: "", capsuleId: "", outfitSetIndex: -1 });
}

async function runConfirmAction(
  state: ConfirmState,
  props: MainScreenProps,
  onCloseRowMenu: () => void,
) {
  const rowDelete = async () => {
    await props.onDeleteCapsule?.(state.capsuleId);
    onCloseRowMenu();
  };
  const rowRevert = async () => {
    await props.onRevertCapsule?.(state.capsuleId);
    onCloseRowMenu();
  };
  const actions: Record<string, () => Promise<void> | void> = {
    delete: () => props.onDeleteCapsule?.(),
    "delete-row": rowDelete,
    revert: () => props.onRevertCapsule?.(),
    "revert-row": rowRevert,
    "delete-outfit-set-image": () =>
      props.onDeleteOutfitSetImage?.(state.outfitSetIndex),
    "regenerate-with-filter-changes": props.onApplyFilters,
    "regenerate-all": props.onRefreshItems,
  };
  if (state.action === "delete-outfit-set-image" && state.outfitSetIndex < 0) {
    return;
  }
  await actions[state.action]?.();
}

function getConfirmCopy(action: string) {
  if (action === "delete-outfit-set-image")
    return [
      "capsule.deleteOutfitSetImageTitle",
      "capsule.deleteOutfitSetImageConfirmBody",
      "capsule.deleteConfirm",
    ];
  if (action === "regenerate-with-filter-changes")
    return [
      "capsule.regenerateWithFilterChangesTitle",
      "capsule.regenerateWithFilterChangesBody",
      "capsule.regenerateWithFilterChangesConfirm",
    ];
  if (action === "regenerate-all")
    return [
      "capsule.regenerateAllTitle",
      "capsule.regenerateAllConfirmBody",
      "capsule.regenerateAllConfirm",
    ];
  if (action.startsWith("delete"))
    return [
      "capsule.deleteTitle",
      "capsule.deleteConfirmBody",
      "capsule.deleteConfirm",
    ];
  return [
    "capsule.revertTitle",
    "capsule.revertConfirmBody",
    "capsule.revertConfirm",
  ];
}

function NameDialog({
  state,
  disabled,
  isOverlay,
  props,
  setState,
}: {
  state: NameDialogState;
  disabled: boolean;
  isOverlay: boolean;
  props: MainScreenProps;
  setState: DialogsProps["setNameDialog"];
}) {
  const { t } = useI18n();
  const isSaveAs = state.type === "save-as";
  const submit = async () => {
    setState({ type: "", capsuleId: "", value: "" });
    if (isSaveAs)
      await props.onDuplicateCapsule?.(state.value, state.capsuleId);
    else await props.onRenameCapsule?.(state.value, state.capsuleId);
  };

  return (
    <Dialog
      open={Boolean(state.type)}
      onClose={() =>
        !disabled && setState({ type: "", capsuleId: "", value: "" })
      }
      fullScreen={isOverlay}
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle>
        {t(isSaveAs ? "capsule.saveAsTitle" : "capsule.renameTitle")}
      </DialogTitle>
      <DialogContent sx={{ pt: 1, pb: 0.5 }}>
        <TextField
          fullWidth
          autoFocus
          disabled={disabled}
          value={state.value}
          onChange={(event) =>
            setState((current) => ({ ...current, value: event.target.value }))
          }
          margin="normal"
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button
          disabled={disabled}
          onClick={() => setState({ type: "", capsuleId: "", value: "" })}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          onClick={() => void submit()}
          disabled={disabled || !state.value.trim()}
        >
          {t("actions.ok")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDialog({
  state,
  disabled,
  isOverlay,
  props,
  setState,
  onCloseRowMenu,
}: {
  state: ConfirmState;
  disabled: boolean;
  isOverlay: boolean;
  props: MainScreenProps;
  setState: DialogsProps["setConfirm"];
  onCloseRowMenu: () => void;
}) {
  const { t } = useI18n();
  const [title, body, button] = getConfirmCopy(state.action);

  return (
    <Dialog
      open={Boolean(state.action)}
      onClose={() => !disabled && clearConfirm(setState)}
      fullScreen={isOverlay}
      fullWidth
      maxWidth="xs"
    >
      <DialogTitle sx={{ pb: 1 }}>{t(title)}</DialogTitle>
      <DialogContent sx={{ pt: 0.5, pb: 0 }}>
        <DialogContentText sx={{ color: "text.secondary" }}>
          {t(body)}
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, pt: 2 }}>
        <Button disabled={disabled} onClick={() => clearConfirm(setState)}>
          {t("actions.cancel")}
        </Button>
        <Button
          color={state.action.startsWith("delete") ? "error" : "primary"}
          variant="contained"
          disabled={disabled}
          onClick={() => {
            const next = state;
            clearConfirm(setState);
            void runConfirmAction(next, props, onCloseRowMenu);
          }}
        >
          {t(button)}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SearchDialog({
  state,
  disabled,
  isOverlay,
  setState,
  onOpenCapsule,
}: {
  state: SearchState;
  disabled: boolean;
  isOverlay: boolean;
  setState: DialogsProps["setSearch"];
  onOpenCapsule?: DialogsProps["onOpenCapsule"];
}) {
  const { t } = useI18n();
  const groups = groupCapsules(state.results);
  const close = () => setState((current) => ({ ...current, open: false }));

  return (
    <Dialog
      open={state.open}
      onClose={() => !disabled && close()}
      fullScreen={isOverlay}
      maxWidth="md"
      fullWidth
    >
      <DialogContent sx={{ p: 0 }}>
        <Stack direction="row" alignItems="center" sx={{ px: 2, py: 2 }}>
          <TextField
            autoFocus
            fullWidth
            variant="standard"
            placeholder={t("capsule.searchPlaceholder")}
            value={state.query}
            disabled={disabled}
            onChange={(event) =>
              setState((current) => ({ ...current, query: event.target.value }))
            }
            InputProps={{ disableUnderline: true }}
          />
          <IconButton disabled={disabled} onClick={close}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
        <Divider />
        {state.loading ? <LinearProgress color="success" /> : null}
        <Box sx={{ p: 2, maxHeight: "70vh", overflowY: "auto" }}>
          {Object.entries(groups).map(([label, group]) => (
            <Stack key={label} spacing={1} sx={{ mb: 3 }}>
              <Typography color="text.secondary">
                {t(`capsule.${label}`)}
              </Typography>
              {group.map((capsule) => (
                <ListItemButton
                  key={capsule.id}
                  disabled={disabled}
                  onClick={() => {
                    void onOpenCapsule?.(String(capsule.id || ""));
                    close();
                  }}
                >
                  <Typography noWrap sx={{ minWidth: 0, flex: 1 }}>
                    {highlightMatch(capsule.name, state.query)}
                  </Typography>
                </ListItemButton>
              ))}
            </Stack>
          ))}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

function ShareDialog({
  state,
  isOverlay,
  setState,
}: {
  state: ShareState;
  isOverlay: boolean;
  setState: DialogsProps["setShare"];
}) {
  const { t } = useI18n();
  const close = () => setState((current) => ({ ...current, open: false }));

  return (
    <Dialog
      open={state.open}
      onClose={close}
      fullScreen={isOverlay}
      fullWidth
      maxWidth="sm"
      aria-labelledby="share-link-dialog-title"
    >
      <DialogTitle>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={2}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <ShareRoundedIcon fontSize="small" />
            <Typography id="share-link-dialog-title" variant="h6">
              {t("capsule.shareTitle")}
            </Typography>
          </Stack>
          <IconButton aria-label={t("actions.close")} onClick={close}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          {t("capsule.shareReady")}
        </Typography>
        <Stack
          direction="row"
          spacing={1.25}
          sx={{ mt: 1.5, p: 1, border: "1px solid", borderColor: "divider" }}
        >
          <Link
            href={state.url}
            target="_blank"
            rel="noreferrer"
            aria-label={state.name || state.url}
            underline="none"
            sx={{ minWidth: 0, flex: 1 }}
          >
            <Typography noWrap sx={{ fontWeight: 700 }}>
              {state.name || state.url}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {state.url}
            </Typography>
          </Link>
          <Tooltip
            title={
              state.copied
                ? t("capsule.shareCopied")
                : t("capsule.copyShareLink")
            }
          >
            <IconButton
              aria-label={t("capsule.copyShareLink")}
              onClick={() => {
                void navigator.clipboard?.writeText(state.url);
                setState((current) => ({ ...current, copied: true }));
              }}
            >
              {state.copied ? <CheckRoundedIcon /> : <ContentCopyRoundedIcon />}
            </IconButton>
          </Tooltip>
        </Stack>
        {state.expiresAt ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            {t("capsule.shareExpires", {
              date: new Date(state.expiresAt).toLocaleString(),
            })}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>{t("actions.close")}</Button>
      </DialogActions>
    </Dialog>
  );
}

function FiltersDialog({
  props,
  disabled,
  open,
  isOverlay,
  setOpen,
}: {
  props: MainScreenProps;
  disabled: boolean;
  open: boolean;
  isOverlay: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={() => !disabled && setOpen(false)}
      fullScreen={isOverlay}
    >
      <DialogTitle>
        <IconButton
          aria-label={t("capsule.closeFilters")}
          disabled={disabled}
          onClick={() => setOpen(false)}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <ProfileFiltersSidebar
          {...props}
          onApply={async () => {
            setOpen(false);
            await props.onApplyFilters();
          }}
          onReset={async () => {
            setOpen(false);
            await props.onResetFilters();
          }}
          onSignOut={null}
          isInteractionDisabled={disabled}
        />
      </DialogContent>
    </Dialog>
  );
}

function ImageDialog({
  src,
  label,
  disabled,
  open,
  setOpen,
}: {
  src: string;
  label?: number;
  disabled: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog
      open={open}
      onClose={() => !disabled && setOpen(false)}
      fullScreen
      maxWidth={false}
      PaperProps={{
        "data-testid": "outfit-set-image-dialog-paper",
        sx: { bgcolor: "transparent", boxShadow: "none" },
      }}
    >
      <Box
        data-testid="outfit-set-image-dialog"
        sx={{
          width: "100vw",
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          p: 2,
        }}
      >
        <IconButton
          aria-label={t("actions.close")}
          disabled={disabled}
          onClick={() => setOpen(false)}
          sx={{
            position: "fixed",
            top: 16,
            right: 16,
            bgcolor: "rgba(255,255,255,0.9)",
          }}
        >
          <CloseRoundedIcon />
        </IconButton>
        {src ? (
          <Box
            component="img"
            src={src}
            alt={`Outfit set ${label || ""}`}
            sx={{
              maxWidth: "calc(100vw - 32px)",
              maxHeight: "calc(100vh - 32px)",
              borderRadius: "8px",
            }}
          />
        ) : null}
      </Box>
    </Dialog>
  );
}

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
    </>
  );
}

export default MainScreenDialogs;
