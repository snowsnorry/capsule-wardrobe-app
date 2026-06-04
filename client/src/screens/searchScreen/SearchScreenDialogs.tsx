import type { ReactElement } from "react";
import {
  Box,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
} from "../../components/MobileDialogSurfaceStyles";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import { SearchFiltersFooter } from "../../search/SearchFiltersSidebarSections";
import ProductDetail from "../../components/productDetail/ProductDetail";
import ProductDetailMobileDialogHeader from "../../components/productDetail/ProductDetailMobileDialogHeader";
import type { SearchResultItem } from "./searchTypes";
import type { SearchScreenStateController } from "./useSearchScreenState";

type SearchScreenDialogsProps = {
  search: SearchScreenStateController;
  t: (key: string, params?: Record<string, unknown>) => string;
  locale: string;
  onRemoveFromMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
  onSaveToMyWardrobe?: (item: SearchResultItem) => Promise<void> | void;
};

function SearchFiltersDialog({
  search,
  t,
}: Pick<SearchScreenDialogsProps, "search" | "t">): ReactElement {
  return (
    <Dialog
      fullScreen
      open={search.isFiltersOpen}
      onClose={() => search.setIsFiltersOpen(false)}
      slotProps={{
        paper: {
          sx: {
            ...mobileCapsuleDialogPaperSx,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          },
        },
      }}
    >
      <DialogTitle sx={mobileCapsuleDialogTitleSx}>
        <Typography
          component="span"
          variant="h6"
          sx={{ color: "text.primary" }}
        >
          {t("filters.title")}
        </Typography>
        <IconButton
          aria-label={t("capsule.closeFilters")}
          onClick={() => search.setIsFiltersOpen(false)}
        >
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent
        sx={{
          ...mobileCapsuleDialogContentSx,
          flex: 1,
          minHeight: 0,
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
          overflowY: "auto",
          px: 2,
          pt: 1,
          pb: 3,
          "&&": {
            pt: 1,
          },
        }}
      >
        <Box sx={{ minHeight: 0, maxWidth: "100%", overflowX: "hidden" }}>
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
            showFooterActions={false}
          />
        </Box>
      </DialogContent>
      <DialogActions sx={mobileCapsuleDialogActionsSx}>
        <SearchFiltersFooter
          status={search.status}
          onApply={async () => {
            await search.applyCurrentQuery();
            search.setIsFiltersOpen(false);
          }}
          onReset={search.resetSearch}
          showApplyButton
          t={t}
        />
      </DialogActions>
    </Dialog>
  );
}

function SearchProductDialog({
  search,
  t,
  locale,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: SearchScreenDialogsProps): ReactElement {
  return (
    <Dialog
      fullScreen
      open={search.isDetailOpen}
      onClose={() => search.setIsDetailOpen(false)}
      slotProps={{
        paper: {
          sx: { ...mobileCapsuleDialogPaperSx, overflowX: "hidden" },
        },
      }}
    >
      <ProductDetailMobileDialogHeader
        item={search.selectedItem}
        t={t}
        onClose={() => search.setIsDetailOpen(false)}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
      <DialogContent
        sx={{
          ...mobileCapsuleDialogContentSx,
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
          px: 3,
          pb: 3,
          "&&": {
            pt: 1,
          },
        }}
      >
        <Stack
          spacing={2.5}
          sx={{ minHeight: "100%", width: "100%", maxWidth: "100%" }}
        >
          <Box
            sx={{
              minHeight: 0,
              maxWidth: "100%",
              overflowX: "hidden",
              overflowY: "auto",
            }}
          >
            <ProductDetail
              item={search.selectedItem}
              t={t}
              locale={locale}
              bodyBottomPadding={1}
            />
          </Box>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}

function SearchScreenDialogs({
  search,
  t,
  locale,
  onRemoveFromMyWardrobe,
  onSaveToMyWardrobe,
}: SearchScreenDialogsProps): ReactElement {
  return (
    <>
      <SearchFiltersDialog search={search} t={t} />
      <SearchProductDialog
        search={search}
        t={t}
        locale={locale}
        onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
        onSaveToMyWardrobe={onSaveToMyWardrobe}
      />
    </>
  );
}

export default SearchScreenDialogs;
