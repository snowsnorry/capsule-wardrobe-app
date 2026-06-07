import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
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
  pickerDialogContentSx,
  pickerDialogFullScreenPaperSx,
  pickerDialogLoadingDividerSx,
  pickerDialogPaperSx,
  pickerGridSx,
  pickerScrollAreaSx,
} from "./ProfileFiltersAnchorStyles";
import AnchorPickerCard from "./ProfileFiltersAnchorPickerCard";
import AnchorDialogActions from "./ProfileFiltersAnchorPickerDialogActions";
import AnchorPickerFilters from "./ProfileFiltersAnchorPickerFilters";

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
  const [likedOnly, setLikedOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<AnchorTypeFilter>("all");

  useEffect(() => {
    if (open) {
      setTempIds(normalizeSelectedIds(selectedIds));
      setSourceFilter("all");
      setLikedOnly(false);
      setTypeFilter("all");
    }
  }, [open, selectedIds]);

  const typeOptions = useAnchorTypeOptions(items);
  const visibleItems = useVisibleAnchorItems(
    items,
    sourceFilter,
    likedOnly,
    typeFilter,
  );
  const selectionText = getSelectionText(tempIds.length, t);

  return (
    <Dialog
      open={open}
      onClose={() => !disabled && onClose()}
      fullScreen={fullScreen}
      fullWidth={!fullScreen}
      maxWidth={fullScreen ? false : "md"}
      slotProps={{
        paper: {
          sx: fullScreen
            ? {
                ...mobileCapsuleDialogPaperSx,
                ...pickerDialogFullScreenPaperSx,
              }
            : pickerDialogPaperSx,
        },
      }}
    >
      <AnchorDialogTitle
        disabled={disabled}
        fullScreen={fullScreen}
        selectionText={selectionText}
        t={t}
        onClose={onClose}
      />
      <DialogLoadingDivider loading={isLoading} />
      <AnchorDialogBody
        error={error}
        fullScreen={fullScreen}
        isLoading={isLoading}
        items={visibleItems}
        likedOnly={likedOnly}
        locale={locale}
        sourceFilter={sourceFilter}
        tempIds={tempIds}
        typeFilter={typeFilter}
        typeOptions={typeOptions}
        t={t}
        onLikedOnlyChange={setLikedOnly}
        onSourceChange={setSourceFilter}
        onToggle={(id) => setTempIds((current) => toggleAnchor(id, current))}
        onTypeChange={setTypeFilter}
      />
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
  likedOnly: boolean,
  typeFilter: AnchorTypeFilter,
) {
  return useMemo(() => {
    const filtered = items.filter((item) => {
      const sourceMatches =
        sourceFilter === "all" || item.source === sourceFilter;
      const likedMatches = !likedOnly || item.isLiked;
      const typeMatches = typeFilter === "all" || item.category === typeFilter;
      return sourceMatches && likedMatches && typeMatches;
    });
    return typeFilter === "all" ? sortWardrobeItems(filtered) : filtered;
  }, [items, likedOnly, sourceFilter, typeFilter]);
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

function AnchorDialogBody({
  error,
  fullScreen,
  isLoading,
  items,
  likedOnly,
  locale,
  onLikedOnlyChange,
  onSourceChange,
  onToggle,
  onTypeChange,
  sourceFilter,
  t,
  tempIds,
  typeFilter,
  typeOptions,
}: {
  error: string;
  fullScreen: boolean;
  isLoading: boolean;
  items: AnchorItem[];
  likedOnly: boolean;
  locale: string;
  onLikedOnlyChange: (value: boolean) => void;
  onSourceChange: (value: AnchorSourceFilter) => void;
  onToggle: (id: string) => void;
  onTypeChange: (value: AnchorTypeFilter) => void;
  sourceFilter: AnchorSourceFilter;
  t: Translate;
  tempIds: string[];
  typeFilter: AnchorTypeFilter;
  typeOptions: string[];
}) {
  return (
    <DialogContent
      sx={
        fullScreen
          ? {
              ...mobileCapsuleDialogContentSx,
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }
          : pickerDialogContentSx
      }
    >
      <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
        <AnchorPickerFilters
          likedOnly={likedOnly}
          locale={locale}
          sourceFilter={sourceFilter}
          typeFilter={typeFilter}
          typeOptions={typeOptions}
          t={t}
          onLikedOnlyChange={onLikedOnlyChange}
          onSourceChange={onSourceChange}
          onTypeChange={onTypeChange}
        />
        {error ? <Alert severity="error">{error}</Alert> : null}
        <Box sx={pickerScrollAreaSx}>
          <AnchorPickerGrid
            isLoading={isLoading}
            items={items}
            locale={locale}
            tempIds={tempIds}
            t={t}
            onToggle={onToggle}
          />
        </Box>
      </Stack>
    </DialogContent>
  );
}

function DialogLoadingDivider({ loading }: { loading: boolean }) {
  return (
    <Box sx={pickerDialogLoadingDividerSx}>
      {loading ? <LinearProgress /> : null}
    </Box>
  );
}

function AnchorPickerGrid({
  isLoading,
  items,
  locale,
  onToggle,
  tempIds,
  t,
}: {
  isLoading: boolean;
  items: AnchorItem[];
  locale: string;
  onToggle: (id: string) => void;
  tempIds: string[];
  t: Translate;
}) {
  if (items.length === 0) {
    return isLoading ? null : (
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
