import { useVirtualizer } from "@tanstack/react-virtual";
import { Box, Stack, Typography } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject,
} from "react";
import ClothingCard from "../components/ClothingCard";
import ClothingGridPlaceholder, {
  buildClothingGridGap,
  buildClothingGridTemplateColumns,
} from "../components/ClothingGridPlaceholder";
import type { ProductMenuOpenOptions } from "../components/ClothingCardTypes";
import {
  getVirtualWardrobeGridColumnCount,
  getVirtualWardrobeGridGapPx,
  getVirtualWardrobeGridRowEstimate,
  shouldVirtualizeWardrobeGrid,
} from "./mainScreen/MainScreenVirtualGrid";
import type { MainScreenItem } from "./mainScreen/MainScreenTypes";

type WardrobeGridProps = {
  hasMore?: boolean;
  highlightedKeys?: string[];
  isFilteredEmpty?: boolean;
  isLoading: boolean;
  isLoadingMore?: boolean;
  isOverlay: boolean;
  items: MainScreenItem[];
  mobileColumns: 1 | 2 | 3;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  onLoadMore?: () => void;
  onProductClick: (item: MainScreenItem) => void;
  onProductMenuOpen: (
    anchor: HTMLElement,
    productUrl: string,
    item: MainScreenItem,
    options: ProductMenuOpenOptions,
  ) => void;
  t: (key: string) => string;
};

// eslint-disable-next-line complexity, max-lines-per-function
function WardrobeGrid({
  hasMore = false,
  highlightedKeys = [],
  isFilteredEmpty = false,
  isLoading,
  isLoadingMore = false,
  isOverlay,
  items,
  mobileColumns,
  onLoadMore,
  onProductClick,
  onProductMenuOpen,
  scrollContainerRef,
  t,
}: WardrobeGridProps) {
  useAutoLoadMore({
    hasMore,
    isLoading,
    isLoadingMore,
    onLoadMore,
    scrollContainerRef,
  });

  if (isLoading) {
    return <ClothingGridPlaceholder count={12} mobileColumns={mobileColumns} />;
  }

  if (items.length === 0) {
    return (
      <Stack spacing={0.75} sx={emptyStateSx}>
        <Typography variant="h6">
          {t(
            isFilteredEmpty
              ? "wardrobe.filteredEmptyTitle"
              : "wardrobe.emptyTitle",
          )}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t(
            isFilteredEmpty
              ? "wardrobe.filteredEmptyBody"
              : "wardrobe.emptyBody",
          )}
        </Typography>
      </Stack>
    );
  }

  const highlightedKeySet = new Set(highlightedKeys);
  const renderItem = (item: MainScreenItem, index: number) => {
    const itemKey = getWardrobeItemKey(item);
    const highlighted = highlightedKeySet.has(itemKey);
    return (
      <Box
        key={itemKey || `personal-item-${index}`}
        data-testid={
          highlighted ? "personal-items-report-item-highlighted" : undefined
        }
        sx={getReportHighlightSx(highlighted)}
      >
        <ClothingCard
          item={item}
          allowProductMenuWithoutUrl
          isMobile={isOverlay}
          mobileColumns={mobileColumns}
          onProductClick={onProductClick}
          onProductMenuOpen={onProductMenuOpen}
        />
      </Box>
    );
  };

  if (
    scrollContainerRef?.current &&
    shouldVirtualizeWardrobeGrid(items.length)
  ) {
    return (
      <>
        <VirtualPersonalItemsGrid
          items={items}
          mobileColumns={mobileColumns}
          renderItem={renderItem}
          scrollContainerRef={scrollContainerRef}
        />
        {isLoadingMore ? (
          <ClothingGridPlaceholder
            count={Math.max(2, mobileColumns * 2)}
            inline
            mobileColumns={mobileColumns}
          />
        ) : null}
      </>
    );
  }

  return (
    <Box sx={personalItemsGridSx(mobileColumns)}>
      {items.map(renderItem)}
      {isLoadingMore ? (
        <ClothingGridPlaceholder
          count={Math.max(2, mobileColumns * 2)}
          inline
          mobileColumns={mobileColumns}
        />
      ) : null}
    </Box>
  );
}

function useAutoLoadMore({
  hasMore,
  isLoading,
  isLoadingMore,
  onLoadMore,
  scrollContainerRef,
}: {
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  onLoadMore?: () => void;
  scrollContainerRef?: RefObject<HTMLElement | null>;
}) {
  useEffect(() => {
    const scrollContainer = scrollContainerRef?.current;
    if (!scrollContainer || !onLoadMore) {
      return undefined;
    }

    const maybeLoadMore = () => {
      if (!hasMore || isLoading || isLoadingMore) {
        return;
      }

      const distanceToBottom =
        scrollContainer.scrollHeight -
        scrollContainer.scrollTop -
        scrollContainer.clientHeight;
      if (distanceToBottom < 720) {
        onLoadMore();
      }
    };

    maybeLoadMore();
    scrollContainer.addEventListener("scroll", maybeLoadMore, {
      passive: true,
    });
    window.addEventListener("resize", maybeLoadMore);
    return () => {
      scrollContainer.removeEventListener("scroll", maybeLoadMore);
      window.removeEventListener("resize", maybeLoadMore);
    };
  }, [hasMore, isLoading, isLoadingMore, onLoadMore, scrollContainerRef]);
}

type VirtualPersonalItemsGridProps = {
  items: MainScreenItem[];
  mobileColumns: 1 | 2 | 3;
  renderItem: (item: MainScreenItem, index: number) => ReactElement;
  scrollContainerRef: RefObject<HTMLElement | null>;
};

// eslint-disable-next-line max-lines-per-function
function VirtualPersonalItemsGrid({
  items,
  mobileColumns,
  renderItem,
  scrollContainerRef,
}: VirtualPersonalItemsGridProps) {
  const theme = useTheme();
  const isSmUp = useMediaQuery(theme.breakpoints.up("sm"));
  const gridRef = useRef<HTMLDivElement | null>(null);
  const gridWidth = useElementWidth(gridRef);
  const scrollMargin = useScrollMargin(gridRef, scrollContainerRef);
  const columnCount = getVirtualWardrobeGridColumnCount({
    containerWidth: gridWidth,
    isSmUp,
    mobileColumns,
  });
  const gapPx = getVirtualWardrobeGridGapPx({ isSmUp, mobileColumns });
  const rows = useMemo(
    () => buildPersonalItemRows(items, columnCount),
    [columnCount, items],
  );
  const viewportHeight = scrollContainerRef.current?.clientHeight || 800;
  const estimateSize = useMemo(
    () =>
      getVirtualWardrobeGridRowEstimate({
        columnCount,
        containerWidth: gridWidth,
        gapPx,
        isSmUp,
        mobileColumns,
      }),
    [columnCount, gapPx, gridWidth, isSmUp, mobileColumns],
  );
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateSize,
    overscan: 3,
    scrollMargin,
    getItemKey: (index) =>
      rows[index]?.map((entry) => getWardrobeItemKey(entry)).join("\u0000") ||
      index,
    initialRect: { width: gridWidth, height: viewportHeight },
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const renderedRows = virtualRows.length
    ? virtualRows
    : getInitialVirtualRows({
        estimateSize,
        rowCount: rows.length,
        viewportHeight,
      });
  const totalHeight = Math.max(
    rowVirtualizer.getTotalSize(),
    rows.length * estimateSize,
  );

  return (
    <Box
      ref={gridRef}
      data-testid="virtual-personal-items-grid"
      sx={{ position: "relative", width: "100%" }}
    >
      <Box sx={{ height: totalHeight, position: "relative", width: "100%" }}>
        {renderedRows.map((virtualRow) => (
          <Box
            key={virtualRow.key}
            ref={rowVirtualizer.measureElement}
            data-index={virtualRow.index}
            data-testid="virtual-personal-items-grid-row"
            sx={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              boxSizing: "border-box",
              display: "grid",
              gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
              gap: `${gapPx}px`,
              pb: `${gapPx}px`,
              transform: `translateY(${virtualRow.start - scrollMargin}px)`,
            }}
          >
            {(rows[virtualRow.index] || []).map((item, index) =>
              renderItem(item, virtualRow.index * columnCount + index),
            )}
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function buildPersonalItemRows(items: MainScreenItem[], columnCount: number) {
  const safeColumnCount = Math.max(1, columnCount);
  const rows: MainScreenItem[][] = [];
  for (let index = 0; index < items.length; index += safeColumnCount) {
    rows.push(items.slice(index, index + safeColumnCount));
  }
  return rows;
}

function getInitialVirtualRows({
  estimateSize,
  rowCount,
  viewportHeight,
}: {
  estimateSize: number;
  rowCount: number;
  viewportHeight: number;
}) {
  const visibleRowCount = Math.min(
    rowCount,
    Math.max(1, Math.ceil(viewportHeight / Math.max(estimateSize, 1)) + 3),
  );
  return Array.from({ length: visibleRowCount }, (_, index) => ({
    index,
    key: `initial-${index}`,
    start: index * estimateSize,
  }));
}

function useElementWidth(ref: RefObject<HTMLElement | null>) {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const updateWidth = () => {
      const rectWidth = node.getBoundingClientRect().width;
      const nextWidth = rectWidth || node.clientWidth || 0;
      setWidth((current) => (current === nextWidth ? current : nextWidth));
    };

    updateWidth();

    if (typeof window.ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const resizeObserver = new window.ResizeObserver(updateWidth);
    resizeObserver.observe(node);
    return () => resizeObserver.disconnect();
  }, [ref]);

  return width;
}

function getScrollMargin(
  grid: HTMLElement | null,
  scrollContainer: HTMLElement | null,
) {
  if (!grid || !scrollContainer) return 0;

  const gridRect = grid.getBoundingClientRect();
  const scrollRect = scrollContainer.getBoundingClientRect();
  return Math.max(0, gridRect.top - scrollRect.top + scrollContainer.scrollTop);
}

function useScrollMargin(
  gridRef: RefObject<HTMLElement | null>,
  scrollContainerRef: RefObject<HTMLElement | null>,
) {
  const [scrollMargin, setScrollMargin] = useState(0);

  useLayoutEffect(() => {
    const nextScrollMargin = getScrollMargin(
      gridRef.current,
      scrollContainerRef.current,
    );
    setScrollMargin((current) =>
      current === nextScrollMargin ? current : nextScrollMargin,
    );
  }, [gridRef, scrollContainerRef]);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scrollContainer = scrollContainerRef.current;
    if (!grid || !scrollContainer) return undefined;

    const updateScrollMargin = () => {
      const nextScrollMargin = getScrollMargin(grid, scrollContainer);
      setScrollMargin((current) =>
        current === nextScrollMargin ? current : nextScrollMargin,
      );
    };

    window.addEventListener("resize", updateScrollMargin);
    if (typeof window.ResizeObserver === "undefined") {
      return () => window.removeEventListener("resize", updateScrollMargin);
    }

    const resizeObserver = new window.ResizeObserver(updateScrollMargin);
    resizeObserver.observe(grid);
    resizeObserver.observe(scrollContainer);
    return () => {
      window.removeEventListener("resize", updateScrollMargin);
      resizeObserver.disconnect();
    };
  }, [gridRef, scrollContainerRef]);

  return scrollMargin;
}

function getWardrobeItemKey(item: MainScreenItem) {
  return String(item?.id || item?.wardrobeId || "").trim();
}

function getReportHighlightSx(highlighted: boolean) {
  return {
    minWidth: 0,
    borderRadius: "var(--cw-radius-card)",
    outline: highlighted
      ? "2px solid var(--cw-color-primary)"
      : "2px solid transparent",
    outlineOffset: 3,
    transition: "outline-color 140ms ease, background-color 140ms ease",
  } as const;
}

const emptyStateSx = {
  maxWidth: 520,
  pt: { xs: 3, md: 4 },
} as const;

function personalItemsGridSx(mobileColumns: 1 | 2 | 3) {
  return {
    display: "grid",
    gridTemplateColumns: buildClothingGridTemplateColumns(mobileColumns),
    gap: buildClothingGridGap(mobileColumns),
    "@media (min-width: 1400px)": {
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    },
    "@media (min-width: 1760px)": {
      gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    },
  } as const;
}

export default WardrobeGrid;
