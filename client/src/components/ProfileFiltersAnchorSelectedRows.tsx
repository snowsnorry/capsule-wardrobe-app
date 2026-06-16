import { Box, Button, IconButton, Stack, Typography } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { AnchorImage } from "./ProfileFiltersAnchorImage";
import {
  getAnchorCategoryLabel,
  getAnchorLabel,
} from "./ProfileFiltersAnchorUtils";
import type { AnchorItem, Translate } from "./ProfileFiltersAnchorTypes";

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

export function AnchorSelectedRows({
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
