import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import AnchorPickerCard from "../../components/ProfileFiltersAnchorPickerCard";
import { pickerDialogLoadingDividerSx } from "../../components/ProfileFiltersAnchorStyles";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { ActiveFilterChip } from "../../search/searchState";
import { toAnchorCardItem, toSnapshot } from "./outfitItemMappers";

export function DialogLoadingDivider({ loading }: { loading: boolean }) {
  return (
    <Box sx={pickerDialogLoadingDividerSx}>
      {loading ? <LinearProgress /> : null}
    </Box>
  );
}

export function CatalogResultsHeader({
  activeChips,
  formattedTotal,
  onDeleteChip,
  t,
}: {
  activeChips: ActiveFilterChip[];
  formattedTotal: string;
  onDeleteChip: (chip: ActiveFilterChip) => void;
  t: Translate;
}) {
  return (
    <Stack spacing={1}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ minWidth: 0 }}
      >
        {t("search.resultsCount", { count: formattedTotal })}
      </Typography>
      {activeChips.length > 0 ? (
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              data-testid={`active-filter-chip-${chip.field}`}
              label={chip.label}
              onDelete={() => onDeleteChip(chip)}
              sx={{
                maxWidth: "100%",
                "& .MuiChip-label": {
                  display: "block",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                },
              }}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}

export function OutfitAddItemsGrid({
  existingKeys,
  gridSx,
  items,
  locale,
  onToggle,
  selectedKeys,
  showEmpty = true,
  source,
  t,
}: {
  existingKeys: Set<string>;
  gridSx: SxProps<Theme>;
  items: WardrobeItem[];
  locale: string;
  onToggle: (snapshot: OutfitItemSnapshot | null) => void;
  selectedKeys: Set<string>;
  showEmpty?: boolean;
  source: "personal" | "catalog";
  t: Translate;
}) {
  if (items.length === 0) {
    return showEmpty ? (
      <Typography variant="body2" color="text.secondary">
        {t("capsule.anchors.empty")}
      </Typography>
    ) : null;
  }

  return (
    <Box sx={gridSx}>
      {items.map((item) => {
        const snapshot = toSnapshot(item, source);
        const key = snapshot?.key || String(item.id || item.url || "");
        const checked = snapshot ? selectedKeys.has(snapshot.key) : false;
        const disabled = snapshot ? existingKeys.has(snapshot.key) : true;
        const anchorItem = toAnchorCardItem(item, key, source);
        return (
          <AnchorPickerCard
            key={key}
            item={anchorItem}
            locale={locale}
            selected={checked}
            selectionFull={disabled}
            t={t}
            onToggle={() => onToggle(snapshot)}
          />
        );
      })}
    </Box>
  );
}
