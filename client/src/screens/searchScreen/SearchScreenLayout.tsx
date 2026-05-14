import type { ReactElement } from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import { MAIN_SCREEN_CONTENT_COLUMN_SX } from "../mainScreen/MainScreenHelpers";
import ProductDetail from "./ProductDetail";
import SearchBar from "./SearchBar";
import SearchResultsList from "./SearchResultsList";
import type { SearchResultItem } from "./searchTypes";
import type { SearchScreenStateController } from "./useSearchScreenState";

type SearchScreenLayoutProps = {
  search: SearchScreenStateController;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  onRemoveFromMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
};

export const SEARCH_DESKTOP_LAYOUT_SX = {
  display: "grid",
  gridTemplateColumns: { lg: "320px minmax(0, 1fr)" },
  gap: { xs: 3, lg: "40px" },
  flex: 1,
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
  pt: 2,
  boxSizing: "border-box",
} as const;

export const SEARCH_DESKTOP_MAIN_SX = {
  display: "grid",
  gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
  gridTemplateRows: "auto minmax(0, 1fr)",
  columnGap: "40px",
  rowGap: 3,
  width: "100%",
  height: "100%",
  minWidth: 0,
  minHeight: 0,
  overflow: "hidden",
} as const;

export const SEARCH_DESKTOP_HEADER_SX = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  gridColumn: "1 / 3",
  gridRow: "1",
  backgroundColor: "background.default",
  zIndex: 1,
} as const;

export const SEARCH_DESKTOP_FILTERS_SX = {
  minHeight: 0,
  alignSelf: "start",
  maxHeight: "calc(100vh - 32px)",
  overflowY: "auto",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "10px",
  backgroundColor: "background.paper",
  p: 3,
} as const;

export const SEARCH_DESKTOP_DETAIL_SX = {
  gridColumn: "2",
  gridRow: "1 / 3",
  minHeight: 0,
  height: "100%",
  overflowY: "auto",
  pt: 9,
  boxSizing: "border-box",
} as const;

export const SEARCH_DESKTOP_DETAIL_CONTENT_SX = {
  width: "100%",
  maxWidth: { lg: "780px" },
  mr: "auto",
  "@media (min-width: 2100px)": {
    maxWidth: "900px",
  },
  "@media (min-width: 2600px)": {
    maxWidth: "980px",
  },
} as const;

export const SEARCH_DESKTOP_RESULTS_SX = {
  ...MAIN_SCREEN_CONTENT_COLUMN_SX,
  minHeight: 0,
  overflow: "hidden",
  pb: 2,
  boxSizing: "border-box",
} as const;

function SearchScreenMobile({
  search,
  t,
}: Omit<SearchScreenLayoutProps, "locale">): ReactElement {
  return (
    <Stack spacing={2} sx={{ minHeight: 0, overflow: "hidden", px: 2, pb: 2 }}>
      <SearchBarView search={search} t={t} isMobile />
      <Divider sx={{ mx: -2 }} />
      <Box sx={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
        <SearchResultsView search={search} t={t} isMobile />
      </Box>
    </Stack>
  );
}

function SearchScreenDesktop({
  search,
  t,
  locale,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: SearchScreenLayoutProps): ReactElement {
  return (
    <Box sx={SEARCH_DESKTOP_LAYOUT_SX}>
      <SearchDesktopFilters search={search} t={t} />
      <Box sx={SEARCH_DESKTOP_MAIN_SX}>
        <Box sx={SEARCH_DESKTOP_HEADER_SX}>
          <SearchBarView search={search} t={t} isMobile={false} />
        </Box>
        <Box sx={SEARCH_DESKTOP_RESULTS_SX}>
          <SearchResultsView search={search} t={t} isMobile={false} />
        </Box>
        <Box sx={SEARCH_DESKTOP_DETAIL_SX}>
          <Box sx={SEARCH_DESKTOP_DETAIL_CONTENT_SX}>
            <ProductDetail
              item={search.selectedItem}
              t={t}
              locale={locale}
              onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
              onSaveToMyWardrobe={onSaveToMyWardrobe}
            />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function SearchDesktopFilters({
  search,
  t,
}: Omit<SearchScreenLayoutProps, "locale">): ReactElement {
  return (
    <Box sx={SEARCH_DESKTOP_FILTERS_SX}>
      <Stack spacing={2.5} sx={{ mb: 3.5 }}>
        <Typography variant="h6" sx={{ color: "text.primary" }}>
          {t("filters.title")}
        </Typography>
        <Divider />
      </Stack>
      <SearchFiltersSidebar
        options={search.options}
        draftState={search.draftState}
        onDraftStateChange={search.changeSidebarDraft}
        status={search.status}
        onApply={async () => {
          await search.applyCurrentQuery();
          search.setIsFiltersOpen(false);
        }}
        onReset={search.resetSearch}
        autoApply
      />
    </Box>
  );
}

function SearchBarView({
  search,
  t,
  isMobile,
}: Omit<SearchScreenLayoutProps, "locale"> & {
  isMobile: boolean;
}): ReactElement {
  return (
    <SearchBar
      isMobile={isMobile}
      query={search.draftState.query}
      t={t}
      onOpenFilters={() => search.setIsFiltersOpen(true)}
      onQueryChange={search.changeQuery}
      onApplyQuery={() => {
        void search.applyCurrentQuery();
      }}
      onClearQuery={() => {
        void search.clearQuery();
      }}
    />
  );
}

function SearchResultsView({
  search,
  t,
  isMobile,
}: Omit<SearchScreenLayoutProps, "locale"> & {
  isMobile: boolean;
}): ReactElement {
  return (
    <SearchResultsList
      isMobile={isMobile}
      t={t}
      formattedTotal={search.formattedTotal}
      status={search.status}
      activeChips={search.activeChips}
      results={search.results}
      selectedResultId={search.selectedResultId}
      total={search.total}
      totalPages={search.totalPages}
      page={search.draftState.page}
      onDeleteActiveChip={(chip) => {
        void search.deleteActiveChip(chip);
      }}
      onSelectResult={search.selectResult}
      onChangePage={search.changePage}
    />
  );
}

export { SearchScreenDesktop, SearchScreenMobile };
