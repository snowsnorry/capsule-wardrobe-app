import type { ReactElement } from "react";
import { Box, Divider, Stack, Typography } from "@mui/material";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import ProductDetail from "./ProductDetail";
import SearchBar from "./SearchBar";
import SearchResultsList from "./SearchResultsList";
import type { SearchScreenStateController } from "./useSearchScreenState";

type SearchScreenLayoutProps = {
  search: SearchScreenStateController;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
};

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
}: SearchScreenLayoutProps): ReactElement {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "320px minmax(0, 1fr)",
        gap: 3,
        flex: 1,
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <SearchDesktopFilters search={search} t={t} />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(280px, 420px) minmax(0, 1fr)",
          gridTemplateRows: "auto minmax(0, 1fr)",
          gap: 3,
          minHeight: 0,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "10px",
          backgroundColor: "background.paper",
          p: 3,
        }}
      >
        <Box sx={{ gridColumn: "1 / 3" }}>
          <SearchBarView search={search} t={t} isMobile={false} />
        </Box>
        <Box sx={{ minHeight: 0, overflow: "hidden" }}>
          <SearchResultsView search={search} t={t} isMobile={false} />
        </Box>
        <Box sx={{ minHeight: 0, overflowY: "auto", pl: 0.5 }}>
          <ProductDetail item={search.selectedItem} t={t} locale={locale} />
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
    <Box
      sx={{
        minHeight: 0,
        alignSelf: "start",
        maxHeight: "100%",
        overflowY: "auto",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "10px",
        backgroundColor: "background.paper",
        p: 3,
      }}
    >
      <Stack spacing={2.5} sx={{ mb: 3.5 }}>
        <Typography
          variant="h6"
          sx={{
            color: "text.primary",
            fontSize: "18px",
            fontWeight: 600,
            lineHeight: 1.25,
          }}
        >
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
