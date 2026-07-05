import { useVirtualizer } from "@tanstack/react-virtual";
import { Box, Chip, LinearProgress, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import { ActiveFilterChipLabel } from "../../components/ActiveFilterChipLabel";
import AnchorPickerCard from "../../components/ProfileFiltersAnchorPickerCard";
import { pickerDialogLoadingDividerSx } from "../../components/ProfileFiltersAnchorStyles";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import type { OutfitItemSnapshot, WardrobeItem } from "../../app/appTypes";
import type { ActiveFilterChip } from "../../search/searchState";
import {
  getOutfitItemKey,
  toAnchorCardItem,
  toSnapshot,
} from "./outfitItemMappers";

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
              label={<ActiveFilterChipLabel chip={chip} />}
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
  maxSelectedReached = false,
  onToggle,
  scrollContainerRef,
  selectedKeys,
  showEmpty = true,
  source,
  t,
}: {
  existingKeys: Set<string>;
  gridSx: SxProps<Theme>;
  items: WardrobeItem[];
  locale: string;
  maxSelectedReached?: boolean;
  onToggle: (snapshot: OutfitItemSnapshot | null) => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
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

  const renderItem = (item: WardrobeItem) => {
    const snapshot = toSnapshot(item, source);
    const key = snapshot
      ? getOutfitItemKey(snapshot)
      : String(item.id || item.url || "");
    const checked = snapshot ? selectedKeys.has(key) : false;
    const disabled =
      (snapshot ? existingKeys.has(key) : true) ||
      (!checked && maxSelectedReached);
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
  };

  if (scrollContainerRef?.current && items.length > 60) {
    return (
      <VirtualOutfitAddItemsGrid
        gridSx={gridSx}
        items={items}
        renderItem={renderItem}
        scrollContainerRef={scrollContainerRef}
      />
    );
  }

  return <Box sx={gridSx}>{items.map(renderItem)}</Box>;
}

function VirtualOutfitAddItemsGrid({
  gridSx,
  items,
  renderItem,
  scrollContainerRef,
}: {
  gridSx: SxProps<Theme>;
  items: WardrobeItem[];
  renderItem: (item: WardrobeItem) => ReactElement;
  scrollContainerRef: RefObject<HTMLElement | null>;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridWidth = useElementWidth(gridRef);
  const columnCount = getPickerColumnCount(gridWidth);
  const rows = useMemo(
    () => buildPickerRows(items, columnCount),
    [columnCount, items],
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => 76,
    overscan: 6,
    getItemKey: (index) =>
      rows[index]
        ?.map((item) => String(item.id || item.url || ""))
        .join("\u0000") || index,
    initialRect: {
      width: gridWidth,
      height: scrollContainerRef.current?.clientHeight || 520,
    },
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const renderedRows = virtualRows.length
    ? virtualRows
    : Array.from({ length: Math.min(rows.length, 10) }, (_, index) => ({
        index,
        key: `initial-${index}`,
        start: index * 76,
      }));

  return (
    <Box ref={gridRef} sx={{ position: "relative", width: "100%" }}>
      <Box
        data-testid="virtual-add-items-personal-grid"
        sx={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}
      >
        {renderedRows.map((virtualRow) => (
          <Box
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            sx={{
              ...(gridSx as Record<string, unknown>),
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            {(rows[virtualRow.index] || []).map(renderItem)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const update = () => {
      const nextWidth = node.getBoundingClientRect().width || node.clientWidth;
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    update();

    if (typeof window.ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const resizeObserver = new window.ResizeObserver(update);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [ref]);

  return width;
}

function getPickerColumnCount(width: number) {
  if (width >= 900) return 3;
  if (width >= 600) return 2;
  return 1;
}

function buildPickerRows(items: WardrobeItem[], columnCount: number) {
  const rows: WardrobeItem[][] = [];
  const safeColumnCount = Math.max(1, columnCount);
  for (let index = 0; index < items.length; index += safeColumnCount) {
    rows.push(items.slice(index, index + safeColumnCount));
  }
  return rows;
}
