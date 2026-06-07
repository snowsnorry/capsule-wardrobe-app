import type { KeyboardEvent } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import type { OutfitItemSnapshot, OutfitMeta } from "../../app/appTypes";
import { buildSummary, outfitHasUnsavedChanges } from "./outfitItemMappers";
import { useOutfitInlineRename } from "./useOutfitInlineRename";
import type { OutfitScreenProps } from "./OutfitScreenTypes";

export function OutfitHeader({
  activeOutfit,
  isContentBusy,
  isMobile,
  items,
  onAdd,
  onCancelSelection,
  onMenuOpen,
  onRenameOutfit,
  onRemoveSelected,
  selectedCount,
  t,
}: {
  activeOutfit: OutfitMeta | null;
  isContentBusy: boolean;
  isMobile: boolean;
  items: OutfitItemSnapshot[];
  onAdd: () => void;
  onCancelSelection: () => void;
  onMenuOpen: (anchor: HTMLElement) => void;
  onRenameOutfit: OutfitScreenProps["onRenameOutfit"];
  onRemoveSelected: () => void;
  selectedCount: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  const inlineRename = useOutfitInlineRename({
    activeOutfit,
    disabled: isContentBusy,
    onRenameOutfit,
  });
  const activeName = activeOutfit?.name || "";
  const disabled =
    !activeOutfit?.id || isContentBusy || inlineRename.submitting;

  return (
    <Stack spacing={1.5}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1.5}
        sx={{ alignItems: { xs: "stretch", sm: "center" } }}
      >
        {isMobile ? null : (
          <OutfitInlineTitle
            activeOutfit={activeOutfit}
            activeName={activeName}
            disabled={disabled}
            inlineRename={inlineRename}
            t={t}
          />
        )}
        <OutfitHeaderActions
          disabled={disabled}
          selectedCount={selectedCount}
          t={t}
          onAdd={onAdd}
          onCancelSelection={onCancelSelection}
          onMenuOpen={onMenuOpen}
          onRemoveSelected={onRemoveSelected}
        />
      </Stack>
      <Typography variant="body2" color="text.secondary">
        {buildSummary(items, t)}
      </Typography>
      <Divider />
    </Stack>
  );
}

function ActiveOutfitUnsavedIndicator({ t }: { t: (key: string) => string }) {
  const label = t("capsule.notSaved");

  return (
    <Tooltip title={label}>
      <FiberManualRecordRoundedIcon
        aria-label={label}
        data-testid="active-outfit-unsaved-indicator"
        role="img"
        sx={{ fontSize: 10, color: "success.main" }}
      />
    </Tooltip>
  );
}

function OutfitInlineTitle({
  activeOutfit,
  activeName,
  disabled,
  inlineRename,
  t,
}: {
  activeOutfit: OutfitMeta | null;
  activeName: string;
  disabled: boolean;
  inlineRename: ReturnType<typeof useOutfitInlineRename>;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  if (inlineRename.active) {
    return (
      <TextField
        autoFocus
        variant="standard"
        value={inlineRename.value}
        disabled={disabled}
        onChange={(event) => inlineRename.setValue(event.target.value)}
        onBlur={() => void inlineRename.submit()}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void inlineRename.submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            inlineRename.cancel();
          }
        }}
        sx={{ minWidth: 0, flex: 1 }}
        slotProps={{ htmlInput: { "aria-label": t("capsule.nameLabel") } }}
      />
    );
  }

  return (
    <Stack
      direction="row"
      spacing={0.75}
      sx={[{ alignItems: "center", flex: 1 }, outfitInlineTitleSx]}
    >
      <Box
        component="button"
        type="button"
        aria-label={t("capsule.renameWithName", { name: activeName })}
        disabled={disabled}
        onClick={inlineRename.start}
        sx={{
          p: 0,
          border: 0,
          background: "transparent",
          color: "inherit",
          minWidth: 0,
        }}
      >
        <Typography variant="h6" noWrap>
          {activeName}
        </Typography>
      </Box>
      {outfitHasUnsavedChanges(activeOutfit) ? (
        <ActiveOutfitUnsavedIndicator t={t} />
      ) : null}
      <Box
        className="outfit-title-edit-action"
        sx={{
          width: 32,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          opacity: 0,
          transition: "opacity 120ms ease",
        }}
      >
        <IconButton
          aria-label={t("capsule.editName")}
          size="small"
          disabled={disabled}
          onClick={inlineRename.start}
        >
          <DriveFileRenameOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Stack>
  );
}

const outfitInlineTitleSx = {
  minWidth: 0,
  "&:hover .outfit-title-edit-action, &:focus-within .outfit-title-edit-action":
    {
      opacity: 1,
    },
} as const;

function OutfitHeaderActions({
  disabled,
  onAdd,
  onCancelSelection,
  onMenuOpen,
  onRemoveSelected,
  selectedCount,
  t,
}: {
  disabled: boolean;
  onAdd: () => void;
  onCancelSelection: () => void;
  onMenuOpen: (anchor: HTMLElement) => void;
  onRemoveSelected: () => void;
  selectedCount: number;
  t: (key: string, params?: Record<string, unknown>) => string;
}) {
  if (selectedCount > 0) {
    return (
      <Stack direction="row" spacing={1} sx={outfitHeaderActionsSx}>
        <Button
          variant="outlined"
          disabled={disabled}
          onClick={onCancelSelection}
        >
          {t("main.cancelSelection")}
        </Button>
        <Button
          color="error"
          variant="contained"
          disabled={disabled}
          onClick={onRemoveSelected}
        >
          {t("outfit.removeSelectedCount", { count: selectedCount })}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack direction="row" spacing={1} sx={outfitHeaderActionsSx}>
      <Button
        variant="outlined"
        startIcon={<AddRoundedIcon />}
        disabled={disabled}
        onClick={onAdd}
        sx={{
          height: 32,
          minHeight: 32,
          py: 0,
          px: 1.5,
        }}
      >
        {t("outfit.addItems")}
      </Button>
      <IconButton
        aria-label={t("outfit.openActions")}
        disabled={disabled}
        onClick={(event) => onMenuOpen(event.currentTarget)}
      >
        <MoreVertRoundedIcon />
      </IconButton>
    </Stack>
  );
}

const outfitHeaderActionsSx = {
  minHeight: 40,
  alignItems: "center",
  justifyContent: "flex-end",
  ml: "auto",
  flexShrink: 0,
} as const;
