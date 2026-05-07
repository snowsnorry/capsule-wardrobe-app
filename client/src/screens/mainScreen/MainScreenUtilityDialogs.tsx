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

function ShareDialogTitle({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
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
      <ShareDialogTitle onClose={close} />
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
