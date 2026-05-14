import type { ReactElement } from "react";
import {
  Box,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import ProductDetail from "./ProductDetail";
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
      PaperProps={{ sx: { overflowX: "hidden" } }}
    >
      <DialogContent
        sx={{
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
          px: 3,
          py: 3,
        }}
      >
        <Stack
          spacing={2.5}
          sx={{ minHeight: "100%", width: "100%", maxWidth: "100%" }}
        >
          <Stack spacing={2.5}>
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Typography variant="h6" sx={{ color: "text.primary" }}>
                {t("filters.title")}
              </Typography>
              <IconButton
                aria-label={t("capsule.closeFilters")}
                onClick={() => search.setIsFiltersOpen(false)}
              >
                <CloseRoundedIcon />
              </IconButton>
            </Stack>
            <Divider />
          </Stack>
          <Box
            sx={{
              minHeight: 0,
              maxWidth: "100%",
              overflowX: "hidden",
              overflowY: "auto",
              pb: 2,
            }}
          >
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
        </Stack>
      </DialogContent>
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
      PaperProps={{ sx: { overflowX: "hidden" } }}
    >
      <DialogContent
        sx={{
          width: "100%",
          boxSizing: "border-box",
          overflowX: "hidden",
          px: 3,
          py: 3,
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
              mobileBackAction={() => search.setIsDetailOpen(false)}
              onRemoveFromMyWardrobe={onRemoveFromMyWardrobe}
              onSaveToMyWardrobe={onSaveToMyWardrobe}
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
