import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { translateOption } from "../i18n";
import {
  CATEGORY_ORDER,
  sortWardrobeItems,
} from "../../../shared/wardrobeOrder.js";
import { normalizeSelectedIds } from "./ProfileFiltersAnchorUtils";
import type {
  AnchorItem,
  AnchorSourceFilter,
  AnchorTypeFilter,
  Translate,
} from "./ProfileFiltersAnchorTypes";
import { MAX_ANCHOR_ITEMS } from "./ProfileFiltersAnchorTypes";
import {
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "./MobileDialogSurfaceStyles";
import {
  dialogTitleSx,
  loadingSx,
  pickerGridSx,
} from "./ProfileFiltersAnchorStyles";
import AnchorPickerCard from "./ProfileFiltersAnchorPickerCard";
import AnchorDialogActions from "./ProfileFiltersAnchorPickerDialogActions";

type WardrobeAnchorPickerDialogProps = {
  disabled: boolean;
  error: string;
  fullScreen?: boolean;
  isLoading: boolean;
  items: AnchorItem[];
  locale: string;
  onApply: (nextIds: string[]) => void;
  onClose: () => void;
  open: boolean;
  selectedIds: string[];
  t: Translate;
};

export function WardrobeAnchorPickerDialog({
  disabled,
  error,
  fullScreen = false,
  isLoading,
  items,
  locale,
  onApply,
  onClose,
  open,
  selectedIds,
  t,
}: WardrobeAnchorPickerDialogProps) {
  const [tempIds, setTempIds] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<AnchorSourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");

  useEffect(() => {
    if (open) {
      setTempIds(normalizeSelectedIds(selectedIds));
      setSourceFilter("all");
      setTypeFilter("all");
    }
  }, [open, selectedIds]);

  const typeOptions = useAnchorTypeOptions(items);
  const visibleItems = useVisibleAnchorItems(items, sourceFilter, typeFilter);
  const selectionText = getSelectionText(tempIds.length, t);

  return (
    <Dialog
      open={open}
      onClose={() => !disabled && onClose()}
      fullScreen={fullScreen}
      fullWidth={!fullScreen}
      maxWidth={fullScreen ? false : "md"}
      slotProps={{
        paper: fullScreen ? { sx: mobileCapsuleDialogPaperSx } : undefined,
      }}
    >
      <AnchorDialogTitle
        disabled={disabled}
        fullScreen={fullScreen}
        selectionText={selectionText}
        t={t}
        onClose={onClose}
      />
      <DialogContent
        dividers={!fullScreen}
        sx={fullScreen ? mobileCapsuleDialogContentSx : undefined}
      >
        <Stack spacing={2.5}>
          <AnchorPickerFilters
            locale={locale}
            sourceFilter={sourceFilter}
            typeFilter={typeFilter}
            typeOptions={typeOptions}
            t={t}
            onSourceChange={setSourceFilter}
            onTypeChange={setTypeFilter}
          />
          {error ? <Alert severity="error">{error}</Alert> : null}
          {isLoading ? (
            <Box sx={loadingSx}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <AnchorPickerGrid
              items={visibleItems}
              locale={locale}
              tempIds={tempIds}
              t={t}
              onToggle={(id) =>
                setTempIds((current) => toggleAnchor(id, current))
              }
            />
          )}
        </Stack>
      </DialogContent>
      <AnchorDialogActions
        disabled={disabled}
        fullScreen={fullScreen}
        tempIds={tempIds}
        t={t}
        onApply={onApply}
        onClose={onClose}
      />
    </Dialog>
  );
}

function useAnchorTypeOptions(items: AnchorItem[]) {
  return useMemo(() => {
    const values = new Set(items.map((item) => item.category).filter(Boolean));
    return CATEGORY_ORDER.filter((category) => values.has(category)).concat(
      [...values].filter((category) => !CATEGORY_ORDER.includes(category)),
    ) as string[];
  }, [items]);
}

function useVisibleAnchorItems(
  items: AnchorItem[],
  sourceFilter: AnchorSourceFilter,
  typeFilter: AnchorTypeFilter,
) {
  return useMemo(() => {
    const filtered = items.filter((item) => {
      const sourceMatches =
        sourceFilter === "all" || item.source === sourceFilter;
      const typeMatches = typeFilter === "all" || item.category === typeFilter;
      return sourceMatches && typeMatches;
    });
    return typeFilter === "all" ? sortWardrobeItems(filtered) : filtered;
  }, [items, sourceFilter, typeFilter]);
}

function getSelectionText(count: number, t: Translate) {
  const key =
    count >= MAX_ANCHOR_ITEMS
      ? "capsule.anchors.selectedMax"
      : "capsule.anchors.selectedCount";
  return t(key, { count, max: MAX_ANCHOR_ITEMS });
}

function toggleAnchor(id: string, current: string[]) {
  if (current.includes(id)) {
    return current.filter((itemId) => itemId !== id);
  }
  if (current.length >= MAX_ANCHOR_ITEMS) {
    return current;
  }
  return [...current, id];
}

function AnchorDialogTitle({
  disabled,
  fullScreen,
  onClose,
  selectionText,
  t,
}: {
  disabled: boolean;
  fullScreen: boolean;
  onClose: () => void;
  selectionText: string;
  t: Translate;
}) {
  return (
    <DialogTitle sx={fullScreen ? mobileCapsuleDialogTitleSx : dialogTitleSx}>
      <Box>
        <Typography component="span" variant="h6">
          {t("capsule.anchors.dialogTitle")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {selectionText}
        </Typography>
      </Box>
      <IconButton
        aria-label={t("actions.close")}
        disabled={disabled}
        onClick={onClose}
      >
        <CloseRoundedIcon />
      </IconButton>
    </DialogTitle>
  );
}

function AnchorPickerFilters({
  locale,
  onSourceChange,
  onTypeChange,
  sourceFilter,
  t,
  typeFilter,
  typeOptions,
}: {
  locale: string;
  onSourceChange: (value: AnchorSourceFilter) => void;
  onTypeChange: (value: AnchorTypeFilter) => void;
  sourceFilter: AnchorSourceFilter;
  t: Translate;
  typeFilter: AnchorTypeFilter;
  typeOptions: string[];
}) {
  return (
    <Stack spacing={1.5}>
      <Stack direction="row" sx={{ flexWrap: "wrap", gap: 1 }}>
        {(["all", "uploaded", "catalog"] as AnchorSourceFilter[]).map(
          (source) => (
            <Chip
              key={source}
              clickable
              color={sourceFilter === source ? "primary" : "default"}
              label={t(`capsule.anchors.sources.${source}`)}
              onClick={() => onSourceChange(source)}
            />
          ),
        )}
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
        <Typography variant="body2" color="text.secondary">
          {t("capsule.anchors.type")}
        </Typography>
        <Select
          size="small"
          value={typeFilter}
          onChange={(event) =>
            onTypeChange(event.target.value as AnchorTypeFilter)
          }
          sx={{ minWidth: 180 }}
        >
          <MenuItem value="all">{t("capsule.anchors.typesAll")}</MenuItem>
          {typeOptions.map((category) => (
            <MenuItem key={category} value={category}>
              {translateOption("categories", category, locale)}
            </MenuItem>
          ))}
        </Select>
      </Stack>
    </Stack>
  );
}

function AnchorPickerGrid({
  items,
  locale,
  onToggle,
  tempIds,
  t,
}: {
  items: AnchorItem[];
  locale: string;
  onToggle: (id: string) => void;
  tempIds: string[];
  t: Translate;
}) {
  if (items.length === 0) {
    return (
      <Typography variant="body2" color="text.secondary">
        {t("capsule.anchors.empty")}
      </Typography>
    );
  }

  return (
    <Box sx={pickerGridSx}>
      {items.map((item) => (
        <AnchorPickerCard
          key={item.id}
          item={item}
          locale={locale}
          selected={tempIds.includes(item.id)}
          selectionFull={tempIds.length >= MAX_ANCHOR_ITEMS}
          t={t}
          onToggle={onToggle}
        />
      ))}
    </Box>
  );
}
