import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
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
import {
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import { useI18n } from "../../i18n/useI18n";
import { groupCapsules, highlightMatch } from "./MainScreenHelpers";
import type {
  DialogsProps,
  SearchState,
  ShareState,
} from "./MainScreenDialogsTypes";

export function SearchDialog({
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
      PaperProps={isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined}
    >
      <DialogContent sx={isOverlay ? mobileSearchContentSx : { p: 0 }}>
        <Stack
          direction="row"
          alignItems="center"
          sx={isOverlay ? mobileCapsuleDialogTitleSx : { px: 2, py: 2 }}
        >
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
        {isOverlay ? null : <Divider />}
        {state.loading ? <LinearProgress color="success" /> : null}
        <Box sx={isOverlay ? mobileSearchResultsSx : desktopSearchResultsSx}>
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

function ShareDialogTitle({
  isOverlay,
  titleKey,
  onClose,
}: {
  isOverlay: boolean;
  titleKey: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <DialogTitle sx={isOverlay ? mobileCapsuleDialogTitleSx : undefined}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={isOverlay ? { width: "100%" } : undefined}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <ShareRoundedIcon fontSize="small" />
          <Typography id="share-link-dialog-title" variant="h6">
            {t(titleKey)}
          </Typography>
        </Stack>
        <IconButton aria-label={t("actions.close")} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </Stack>
    </DialogTitle>
  );
}

export function ShareDialog({
  state,
  isOverlay,
  setState,
}: {
  state: ShareState;
  isOverlay: boolean;
  setState: DialogsProps["setShare"];
}) {
  const { t } = useI18n();
  const isBlocked = state.blockedReason === "personal_uploaded_items";
  const close = () => setState((current) => ({ ...current, open: false }));

  return (
    <Dialog
      open={state.open}
      onClose={close}
      fullScreen={isOverlay}
      fullWidth
      maxWidth="sm"
      aria-labelledby="share-link-dialog-title"
      PaperProps={isOverlay ? { sx: mobileCapsuleDialogPaperSx } : undefined}
    >
      <ShareDialogTitle
        isOverlay={isOverlay}
        titleKey={
          isBlocked ? "capsule.shareBlockedTitle" : "capsule.shareTitle"
        }
        onClose={close}
      />
      <DialogContent sx={isOverlay ? mobileCapsuleDialogContentSx : undefined}>
        {isBlocked ? (
          <BlockedShareDialogContent />
        ) : (
          <ShareLinkDialogContent state={state} setState={setState} />
        )}
      </DialogContent>
      {isOverlay ? null : (
        <DialogActions>
          <Button onClick={close}>{t("actions.close")}</Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

const mobileSearchContentSx = {
  ...mobileCapsuleDialogContentSx,
  p: 0,
  "&&": {
    pt: 0,
  },
  display: "flex",
  flexDirection: "column",
} as const;

const mobileSearchResultsSx = {
  px: 2,
  pt: 1,
  pb: 2,
  flex: 1,
  minHeight: 0,
  overflowY: "auto",
} as const;

const desktopSearchResultsSx = {
  p: 2,
  maxHeight: "70vh",
  overflowY: "auto",
} as const;

function BlockedShareDialogContent() {
  const { t } = useI18n();
  return (
    <Typography variant="body2" color="text.secondary">
      {t("capsule.shareBlockedBody")}
    </Typography>
  );
}

function ShareLinkDialogContent({
  state,
  setState,
}: {
  state: ShareState;
  setState: DialogsProps["setShare"];
}) {
  const { t } = useI18n();
  return (
    <>
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
            state.copied ? t("capsule.shareCopied") : t("capsule.copyShareLink")
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
    </>
  );
}
