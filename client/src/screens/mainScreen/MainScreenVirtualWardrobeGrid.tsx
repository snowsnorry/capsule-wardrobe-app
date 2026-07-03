import { useVirtualizer } from "@tanstack/react-virtual";
import { Box } from "@mui/material";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { MobileCardColumns } from "./MainScreenTypes";
import {
  buildWardrobeGridRows,
  getVirtualWardrobeGridColumnCount,
  getVirtualWardrobeGridGapPx,
  getVirtualWardrobeGridRowEstimate,
  type WardrobeGridEntry,
} from "./MainScreenVirtualGrid";

type VirtualWardrobeGridProps = {
  entries: WardrobeGridEntry[];
  mobileColumns: MobileCardColumns;
  scrollContainerRef: RefObject<HTMLElement | null>;
  renderEntry: (entry: WardrobeGridEntry) => ReactNode;
};

function VirtualWardrobeGrid({
  entries,
  mobileColumns,
  renderEntry,
  scrollContainerRef,
}: VirtualWardrobeGridProps) {
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
  const rows = useWardrobeGridRows(entries, columnCount);
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
  const rowVirtualizer = useWardrobeRowVirtualizer({
    estimateSize,
    gridWidth,
    rows,
    scrollContainerRef,
    scrollMargin,
    viewportHeight,
  });
  const renderedRows = useRenderedVirtualRows({
    estimateSize,
    rows,
    rowVirtualizer,
    viewportHeight,
  });
  const totalHeight = Math.max(
    rowVirtualizer.getTotalSize(),
    rows.length * estimateSize,
  );

  return (
    <VirtualWardrobeGridFrame
      columnCount={columnCount}
      gapPx={gapPx}
      gridRef={gridRef}
      renderedRows={renderedRows}
      rows={rows}
      scrollMargin={scrollMargin}
      totalHeight={totalHeight}
      measureElement={rowVirtualizer.measureElement}
      renderEntry={renderEntry}
    />
  );
}

function useWardrobeGridRows(
  entries: WardrobeGridEntry[],
  columnCount: number,
) {
  return useMemo(
    () => buildWardrobeGridRows(entries, columnCount),
    [columnCount, entries],
  );
}

function useWardrobeRowVirtualizer({
  estimateSize,
  gridWidth,
  rows,
  scrollContainerRef,
  scrollMargin,
  viewportHeight,
}: {
  estimateSize: number;
  gridWidth: number;
  rows: WardrobeGridEntry[][];
  scrollContainerRef: RefObject<HTMLElement | null>;
  scrollMargin: number;
  viewportHeight: number;
}) {
  return useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => estimateSize,
    overscan: 3,
    scrollMargin,
    getItemKey: (index) =>
      rows[index]?.map((entry) => entry.key).join("\u0000") || index,
    initialRect: {
      width: gridWidth,
      height: viewportHeight,
    },
  });
}

function useRenderedVirtualRows({
  estimateSize,
  rows,
  rowVirtualizer,
  viewportHeight,
}: {
  estimateSize: number;
  rows: WardrobeGridEntry[][];
  rowVirtualizer: ReturnType<typeof useWardrobeRowVirtualizer>;
  viewportHeight: number;
}) {
  const virtualRows = rowVirtualizer.getVirtualItems();
  return virtualRows.length
    ? virtualRows
    : getInitialVirtualRows({
        estimateSize,
        rowCount: rows.length,
        viewportHeight,
      });
}

function VirtualWardrobeGridFrame({
  columnCount,
  gapPx,
  gridRef,
  measureElement,
  renderedRows,
  renderEntry,
  rows,
  scrollMargin,
  totalHeight,
}: {
  columnCount: number;
  gapPx: number;
  gridRef: RefObject<HTMLDivElement | null>;
  measureElement: (node: Element | null) => void;
  renderedRows: Array<{
    index: number;
    key: string | number | bigint;
    start: number;
  }>;
  renderEntry: (entry: WardrobeGridEntry) => ReactNode;
  rows: WardrobeGridEntry[][];
  scrollMargin: number;
  totalHeight: number;
}) {
  return (
    <Box
      ref={gridRef}
      data-column-count={columnCount}
      data-scroll-margin={scrollMargin}
      data-testid="virtual-wardrobe-grid"
      sx={{ width: "100%", position: "relative" }}
    >
      <Box sx={{ height: totalHeight, position: "relative", width: "100%" }}>
        {renderedRows.map((virtualRow) => (
          <Box
            key={virtualRow.key}
            ref={measureElement}
            data-index={virtualRow.index}
            data-testid="virtual-wardrobe-grid-row"
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
            {(rows[virtualRow.index] || []).map(renderEntry)}
          </Box>
        ))}
      </Box>
    </Box>
  );
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

export default VirtualWardrobeGrid;
