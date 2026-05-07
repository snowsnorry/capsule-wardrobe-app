import type { ReactElement } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Pagination,
  Stack,
  Typography,
} from "@mui/material";
import ProductLabelText from "../../components/ProductLabelText";
import type { ActiveFilterChip } from "../../search/searchState";
import type { SearchResultItem, SearchStatus } from "./searchTypes";

type SearchResultsListProps = {
  isMobile: boolean;
  t: (key: string, params?: Record<string, unknown>) => string;
  formattedTotal: string;
  status: SearchStatus;
  activeChips: ActiveFilterChip[];
  results: SearchResultItem[];
  selectedResultId: string | number | null;
  total: number;
  totalPages: number;
  page: number;
  onDeleteActiveChip: (chip: ActiveFilterChip) => void;
  onSelectResult: (item: SearchResultItem) => void;
  onChangePage: (event: unknown, page: number) => void;
};

function SearchResultsList({
  isMobile,
  t,
  formattedTotal,
  status,
  activeChips,
  results,
  selectedResultId,
  total,
  totalPages,
  page,
  onDeleteActiveChip,
  onSelectResult,
  onChangePage,
}: SearchResultsListProps): ReactElement {
  return (
    <Stack spacing={2} sx={{ minHeight: 0, height: "100%" }}>
      <ResultsHeader
        t={t}
        formattedTotal={formattedTotal}
        status={status}
        activeChips={activeChips}
        onDeleteActiveChip={onDeleteActiveChip}
      />
      <Divider />
      <Stack
        spacing={1.1}
        sx={{ flex: 1, minHeight: 0, overflowY: "auto", pr: 0.5 }}
      >
        {results.length === 0 && !status.loading ? (
          <Typography variant="body2" color="text.secondary">
            {t("search.empty")}
          </Typography>
        ) : null}
        {results.map((item) => (
          <ResultListItem
            key={item.id}
            item={item}
            isMobile={isMobile}
            isSelected={String(selectedResultId) === String(item.id)}
            t={t}
            onSelectResult={onSelectResult}
          />
        ))}
      </Stack>
      {total > 50 ? (
        <Pagination
          page={page}
          count={totalPages}
          onChange={onChangePage}
          shape="rounded"
          color="primary"
          siblingCount={isMobile ? 0 : 1}
          boundaryCount={isMobile ? 1 : 2}
          sx={{
            alignSelf: "center",
            maxWidth: "100%",
            "& .MuiPagination-ul": {
              flexWrap: "nowrap",
              justifyContent: "center",
            },
          }}
        />
      ) : null}
    </Stack>
  );
}

function ResultsHeader({
  t,
  formattedTotal,
  status,
  activeChips,
  onDeleteActiveChip,
}: Pick<
  SearchResultsListProps,
  "t" | "formattedTotal" | "status" | "activeChips" | "onDeleteActiveChip"
>) {
  return (
    <Stack spacing={1}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          variant="overline"
          color="text.secondary"
          sx={{ minWidth: 0 }}
        >
          {t("search.resultsCount", { count: formattedTotal })}
        </Typography>
        {status.loading ? <CircularProgress size={18} /> : null}
      </Stack>
      {activeChips.length > 0 ? (
        <Stack direction="row" flexWrap="wrap" gap={1} useFlexGap>
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              label={chip.label}
              onDelete={() => onDeleteActiveChip(chip)}
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

function ResultListItem({
  item,
  isMobile,
  isSelected,
  t,
  onSelectResult,
}: {
  item: SearchResultItem;
  isMobile: boolean;
  isSelected: boolean;
  t: SearchResultsListProps["t"];
  onSelectResult: (item: SearchResultItem) => void;
}) {
  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={() => onSelectResult(item)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelectResult(item);
        }
      }}
      sx={{
        pl: "10px",
        pr: 0.5,
        py: 1.1,
        borderRadius: 0,
        cursor: "pointer",
        border: "none",
        backgroundColor: isSelected
          ? "rgba(28, 124, 124, 0.06)"
          : "transparent",
        transition: "background-color 160ms ease, transform 160ms ease",
        outline: "none",
        "&:hover": {
          backgroundColor: "rgba(31, 41, 51, 0.035)",
        },
      }}
      data-mobile-result={isMobile ? "true" : undefined}
    >
      <Typography variant="body1" sx={{ fontWeight: 700 }}>
        <ProductLabelText item={item} fallbackLabel={t("search.untitled")} />
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {item.brand || t("search.noBrand")}
      </Typography>
    </Box>
  );
}

export default SearchResultsList;
