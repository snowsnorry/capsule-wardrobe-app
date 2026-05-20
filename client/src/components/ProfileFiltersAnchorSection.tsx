import { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { fetchMyWardrobeItems } from "../api/myWardrobe";
import { sortWardrobeItems } from "../../../shared/wardrobeOrder.js";
import { AnchorImage } from "./ProfileFiltersAnchorImage";
import { WardrobeAnchorPickerDialog } from "./ProfileFiltersAnchorPickerDialog";
import {
  getAnchorCategoryLabel,
  getAnchorLabel,
  normalizeSelectedIds,
  toAnchorItem,
} from "./ProfileFiltersAnchorUtils";
import type {
  AnchorItem,
  ProfileFiltersAnchorSectionProps,
  Translate,
} from "./ProfileFiltersAnchorTypes";

function ProfileFiltersAnchorSection({
  anchorPickerFullScreen = false,
  disabled,
  selectedIds,
  onChange,
  t,
  locale,
}: ProfileFiltersAnchorSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [items, setItems] = useState<AnchorItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const normalizedSelectedIds = useMemo(
    () => normalizeSelectedIds(selectedIds),
    [selectedIds],
  );

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await fetchMyWardrobeItems({ force: true });
      const nextItems = Array.isArray(response.items)
        ? response.items.map(toAnchorItem).filter(Boolean)
        : [];
      setItems(sortWardrobeItems(nextItems as AnchorItem[]));
    } catch {
      setError(t("capsule.anchors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (dialogOpen || normalizedSelectedIds.length > 0) {
      void loadItems();
    }
  }, [dialogOpen, loadItems, normalizedSelectedIds.length]);

  const itemById = useMemo(
    () => new Map(items.map((item) => [item.id, item])),
    [items],
  );
  const canEdit = !disabled && Boolean(onChange);

  return (
    <Stack spacing={1.5}>
      <AnchorSectionHeader t={t} />
      {normalizedSelectedIds.length === 0 ? (
        <AnchorEmptyButton
          canEdit={canEdit}
          t={t}
          onOpen={() => setDialogOpen(true)}
        />
      ) : (
        <AnchorSelectedRows
          canEdit={canEdit}
          itemById={itemById}
          locale={locale}
          selectedIds={normalizedSelectedIds}
          t={t}
          onEdit={() => setDialogOpen(true)}
          onChange={onChange}
        />
      )}
      <WardrobeAnchorPickerDialog
        open={dialogOpen}
        disabled={disabled}
        error={error}
        isLoading={isLoading}
        items={items}
        locale={locale}
        fullScreen={anchorPickerFullScreen}
        selectedIds={normalizedSelectedIds}
        t={t}
        onApply={(nextIds) => {
          onChange?.(nextIds);
          setDialogOpen(false);
        }}
        onClose={() => setDialogOpen(false)}
      />
    </Stack>
  );
}

function AnchorSectionHeader({ t }: { t: Translate }) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
        {t("capsule.anchors.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {t("capsule.anchors.hint")}
      </Typography>
    </Stack>
  );
}

function AnchorEmptyButton({
  canEdit,
  onOpen,
  t,
}: {
  canEdit: boolean;
  onOpen: () => void;
  t: Translate;
}) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      startIcon={<AddRoundedIcon />}
      disabled={!canEdit}
      onClick={onOpen}
      sx={{ justifyContent: "center" }}
    >
      {t("capsule.anchors.add")}
    </Button>
  );
}

function AnchorSelectedRows({
  canEdit,
  itemById,
  locale,
  onChange,
  onEdit,
  selectedIds,
  t,
}: {
  canEdit: boolean;
  itemById: Map<string, AnchorItem>;
  locale: string;
  onChange?: (value: string[]) => void;
  onEdit: () => void;
  selectedIds: string[];
  t: Translate;
}) {
  return (
    <Stack spacing={1}>
      {selectedIds.map((id) => (
        <AnchorSelectedRow
          key={id}
          id={id}
          item={itemById.get(id) || null}
          disabled={!canEdit}
          locale={locale}
          t={t}
          onRemove={() =>
            onChange?.(selectedIds.filter((itemId) => itemId !== id))
          }
        />
      ))}
      <Button
        variant="outlined"
        color="inherit"
        startIcon={<AddRoundedIcon />}
        disabled={!canEdit}
        onClick={onEdit}
        sx={{ alignSelf: "flex-start" }}
      >
        {t("capsule.anchors.edit")}
      </Button>
    </Stack>
  );
}

function AnchorSelectedRow({
  disabled,
  id,
  item,
  locale,
  onRemove,
  t,
}: {
  disabled: boolean;
  id: string;
  item: AnchorItem | null;
  locale: string;
  onRemove: () => void;
  t: Translate;
}) {
  const label = getAnchorLabel(item, id, t);

  return (
    <Box sx={selectedRowSx}>
      <AnchorImage item={item} label={label} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
          {label}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {getAnchorCategoryLabel(item?.category || null, locale) || id}
        </Typography>
      </Box>
      <IconButton
        size="small"
        aria-label={t("capsule.anchors.remove", { name: label })}
        disabled={disabled}
        onClick={onRemove}
      >
        <CloseRoundedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

const selectedRowSx = {
  display: "flex",
  alignItems: "center",
  gap: 1.25,
  minWidth: 0,
  p: 0.75,
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "var(--cw-radius-card)",
  bgcolor: "background.paper",
} as const;

export default ProfileFiltersAnchorSection;
