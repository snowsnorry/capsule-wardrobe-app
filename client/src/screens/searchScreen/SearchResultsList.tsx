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
import BookmarkBorderRoundedIcon from "@mui/icons-material/BookmarkBorderRounded";
import FavoriteRoundedIcon from "@mui/icons-material/FavoriteRounded";
import { ActiveFilterChipLabel } from "../../components/ActiveFilterChipLabel";
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
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
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
        <Stack direction="row" useFlexGap sx={{ flexWrap: "wrap", gap: 1 }}>
          {activeChips.map((chip) => (
            <Chip
              key={chip.key}
              data-testid={`active-filter-chip-${chip.field}`}
              label={<ActiveFilterChipLabel chip={chip} />}
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
  const isSavedToWardrobe = Boolean(item.isSavedToWardrobe);
  const isLiked = Boolean(item.isLiked);
  const likedLabel = t("wardrobe.likedBadge");
  const savedLabel = t("wardrobe.savedBadge");

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
      sx={getResultListItemSx(isSelected)}
      data-mobile-result={isMobile ? "true" : undefined}
    >
      <Typography variant="body1" sx={{ fontWeight: 700 }}>
        {isLiked ? (
          <FavoriteRoundedIcon
            className="catalog-result-liked-icon"
            titleAccess={likedLabel}
            aria-label={likedLabel}
            sx={{
              color: "var(--cw-color-liked-indicator, #c62828)",
              display: "inline-block",
              fontSize: 16,
              mr: 0.45,
              verticalAlign: "-0.16em",
            }}
          />
        ) : null}
        {isSavedToWardrobe ? (
          <BookmarkBorderRoundedIcon
            className="catalog-result-saved-icon"
            titleAccess={savedLabel}
            aria-label={savedLabel}
            sx={{
              color: "var(--cw-color-product-saved-indicator)",
              display: "inline-block",
              fontSize: 16,
              mr: 0.45,
              verticalAlign: "-0.16em",
            }}
          />
        ) : null}
        <ProductLabelText item={item} fallbackLabel={t("search.untitled")} />
      </Typography>
      <Stack
        direction="row"
        spacing={0.75}
        sx={{ alignItems: "center", minWidth: 0 }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {item.brand || t("search.noBrand")}
        </Typography>
      </Stack>
    </Box>
  );
}

function getResultListItemSx(isSelected: boolean) {
  return {
    pl: "10px",
    pr: 0.5,
    py: 1.1,
    position: "relative",
    borderRadius: "var(--cw-radius-card)",
    cursor: "pointer",
    border: "1px solid",
    borderColor: isSelected ? "primary.main" : "transparent",
    backgroundColor: isSelected ? "var(--cw-color-action-wash)" : "transparent",
    transition:
      "background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
    "&:hover": {
      backgroundColor: isSelected
        ? "var(--cw-color-action-wash)"
        : "var(--cw-color-action-hover)",
    },
    "&:focus-visible": {
      outline: "none",
      borderColor: "primary.main",
      boxShadow: "inset 0 0 0 2px var(--cw-color-primary)",
    },
  } as const;
}

export default SearchResultsList;
