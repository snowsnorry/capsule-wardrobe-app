import { Box, Divider, Pagination, Stack, Typography } from "@mui/material";
import AnchorPickerFilters from "../../components/ProfileFiltersAnchorPickerFilters";
import {
  pickerGridSx,
  pickerScrollAreaSx,
} from "../../components/ProfileFiltersAnchorStyles";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import SearchBar from "../searchScreen/SearchBar";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import {
  catalogDesktopDividerSx,
  catalogDesktopFiltersSx,
  catalogPaginationSx,
  catalogPickerGridSx,
  catalogResultsPaneSx,
  catalogResultsScrollSx,
  catalogTabLayoutSx,
} from "./OutfitScreenStyles";
import {
  CatalogResultsHeader,
  OutfitAddItemsGrid,
} from "./OutfitAddItemsDialogParts";
import {
  CATALOG_PICKER_PAGE_SIZE,
  type OutfitAddItemsDialogModel,
} from "./useOutfitAddItemsDialog";

export function AddItemsDialogSelectionSummary({
  catalogCount,
  personalCount,
  t,
}: {
  catalogCount: number;
  personalCount: number;
  t: Translate;
}) {
  const totalParts = [
    personalCount ? t("outfit.personalSelected", { count: personalCount }) : "",
    catalogCount ? t("outfit.catalogSelected", { count: catalogCount }) : "",
  ].filter(Boolean);
  return (
    <Typography variant="body2" color="text.secondary">
      {totalParts.length ? totalParts.join(" · ") : t("outfit.noneSelected")}
    </Typography>
  );
}

export function AddItemsPersonalPanel({
  locale,
  model,
  t,
}: {
  locale: string;
  model: OutfitAddItemsDialogModel;
  t: Translate;
}) {
  return (
    <Stack spacing={2.5} sx={{ flex: 1, minHeight: 0 }}>
      <AnchorPickerFilters
        likedOnly={model.likedOnly}
        locale={locale}
        sourceFilter={model.sourceFilter}
        typeFilter={model.typeFilter}
        typeOptions={model.typeOptions}
        t={t}
        onLikedOnlyChange={model.setLikedOnly}
        onSourceChange={model.setSourceFilter}
        onTypeChange={model.setTypeFilter}
      />
      <Box sx={pickerScrollAreaSx}>
        <OutfitAddItemsGrid
          existingKeys={model.existingKeys}
          gridSx={pickerGridSx}
          items={model.visiblePersonalItems}
          locale={locale}
          maxSelectedReached={model.maxSelectedReached}
          selectedKeys={model.selectedKeys}
          showEmpty={!model.personalLoading}
          source="personal"
          t={t}
          onToggle={model.toggle}
        />
      </Box>
    </Stack>
  );
}

function CatalogFilters({
  autoApply,
  model,
}: {
  autoApply: boolean;
  model: OutfitAddItemsDialogModel;
}) {
  return (
    <SearchFiltersSidebar
      options={model.catalogOptions}
      draftState={
        autoApply
          ? model.catalogDraftState
          : model.catalogMobileFiltersDraftState
      }
      status={model.catalogStatus}
      onDraftStateChange={
        autoApply
          ? model.changeCatalogDraft
          : model.changeCatalogMobileFiltersDraft
      }
      onApply={model.applyCatalogSearch}
      onReset={model.resetCatalogSearch}
      autoApply={autoApply}
      showFooterActions={false}
    />
  );
}

export function AddItemsCatalogFilters({
  model,
}: {
  model: OutfitAddItemsDialogModel;
}) {
  return <CatalogFilters autoApply={false} model={model} />;
}

export function AddItemsCatalogPanel({
  formattedTotal,
  locale,
  model,
  totalPages,
  t,
}: {
  formattedTotal: string;
  locale: string;
  model: OutfitAddItemsDialogModel;
  totalPages: number;
  t: Translate;
}) {
  return (
    <Box sx={catalogTabLayoutSx}>
      <Box sx={catalogDesktopFiltersSx}>
        <Stack spacing={2.5} sx={{ mb: 3.5 }}>
          <Typography variant="h6" sx={{ color: "text.primary" }}>
            {t("filters.title")}
          </Typography>
          <Divider />
        </Stack>
        <CatalogFilters autoApply model={model} />
      </Box>
      <Divider orientation="vertical" sx={catalogDesktopDividerSx} />
      <Stack spacing={2} sx={catalogResultsPaneSx}>
        <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
          <SearchBar
            isMobile={model.isCatalogMobile}
            query={model.catalogDraftState.query}
            t={t}
            onOpenFilters={model.openCatalogFilters}
            onQueryChange={(query) =>
              model.setCatalogDraftState((current) => ({
                ...current,
                query,
                page: 1,
              }))
            }
            onApplyQuery={() => {
              void model.applyCatalogSearch();
            }}
            onClearQuery={() => {
              void model.clearCatalogQuery();
            }}
          />
          <CatalogResultsHeader
            activeChips={model.catalogActiveChips}
            formattedTotal={formattedTotal}
            t={t}
            onDeleteChip={model.deleteCatalogChip}
          />
        </Stack>
        <Box sx={catalogResultsScrollSx}>
          {model.catalogStatus.error ? (
            <Typography variant="body2" color="error">
              {model.catalogStatus.error}
            </Typography>
          ) : null}
          <OutfitAddItemsGrid
            existingKeys={model.existingKeys}
            gridSx={catalogPickerGridSx}
            items={model.visibleCatalogItems}
            locale={locale}
            maxSelectedReached={model.maxSelectedReached}
            selectedKeys={model.selectedKeys}
            showEmpty={!model.catalogStatus.loading}
            source="catalog"
            t={t}
            onToggle={model.toggle}
          />
        </Box>
        {model.catalogTotal > CATALOG_PICKER_PAGE_SIZE ? (
          <Pagination
            page={model.catalogDraftState.page}
            count={totalPages}
            onChange={model.changeCatalogPage}
            shape="rounded"
            color="primary"
            siblingCount={model.isCatalogMobile ? 0 : 1}
            boundaryCount={model.isCatalogMobile ? 1 : 2}
            sx={catalogPaginationSx}
          />
        ) : null}
      </Stack>
    </Box>
  );
}
