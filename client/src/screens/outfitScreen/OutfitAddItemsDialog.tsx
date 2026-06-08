import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import type { OutfitItemSnapshot } from "../../app/appTypes";
import {
  getAddItemsDialogActionsSx,
  getAddItemsDialogContentSx,
  getAddItemsDialogPaperSx,
  getAddItemsDialogTitleSx,
} from "./OutfitAddItemsDialogStyles";
import { DialogLoadingDivider } from "./OutfitAddItemsDialogParts";
import {
  AddItemsCatalogFilters,
  AddItemsCatalogPanel,
  AddItemsDialogSelectionSummary,
  AddItemsPersonalPanel,
} from "./OutfitAddItemsDialogPanels";
import {
  CATALOG_PICKER_PAGE_SIZE,
  EMPTY_INITIAL_ITEMS,
  useOutfitAddItemsDialog,
} from "./useOutfitAddItemsDialog";
import { OutfitCatalogFiltersDialog } from "./OutfitCatalogFiltersDialog";

type AddItemsDialogProps = {
  existingItems: OutfitItemSnapshot[];
  initialItems?: OutfitItemSnapshot[];
  locale: string;
  maxSelected?: number | null;
  fullScreenOverride?: boolean | null;
  allowEmptySelection?: boolean;
  open: boolean;
  actionLabel?: string | null;
  onAdd: (items: OutfitItemSnapshot[]) => void;
  onClose: () => void;
  t: Translate;
};

type AddItemsDialogSurfaceProps = AddItemsDialogProps & {
  fullScreen: boolean;
  model: ReturnType<typeof useOutfitAddItemsDialog>;
};

export function AddItemsDialog({
  existingItems,
  initialItems = EMPTY_INITIAL_ITEMS,
  locale,
  maxSelected = null,
  fullScreenOverride = null,
  allowEmptySelection = false,
  open,
  actionLabel = null,
  onAdd,
  onClose,
  t,
}: AddItemsDialogProps) {
  const model = useOutfitAddItemsDialog({
    existingItems,
    initialItems,
    locale,
    maxSelected,
    open,
    t,
  });
  const fullScreen = fullScreenOverride ?? model.isCatalogMobile;

  return (
    <AddItemsDialogSurface
      actionLabel={actionLabel}
      allowEmptySelection={allowEmptySelection}
      existingItems={existingItems}
      fullScreen={fullScreen}
      fullScreenOverride={fullScreenOverride}
      initialItems={initialItems}
      locale={locale}
      maxSelected={maxSelected}
      model={model}
      onAdd={onAdd}
      onClose={onClose}
      open={open}
      t={t}
    />
  );
}

function AddItemsDialogSurface({
  actionLabel,
  allowEmptySelection,
  fullScreen,
  locale,
  model,
  onAdd,
  onClose,
  open,
  t,
}: AddItemsDialogSurfaceProps) {
  const catalogFormattedTotal = new Intl.NumberFormat(locale).format(
    model.catalogTotal,
  );
  const catalogTotalPages = Math.max(
    1,
    Math.ceil(model.catalogTotal / CATALOG_PICKER_PAGE_SIZE),
  );
  const isDialogLoading = model.personalLoading || model.catalogStatus.loading;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth={!fullScreen}
      maxWidth={fullScreen ? false : "md"}
      slotProps={{
        paper: {
          sx: getAddItemsDialogPaperSx(fullScreen),
        },
      }}
    >
      <DialogTitle sx={getAddItemsDialogTitleSx(fullScreen)}>
        <Stack spacing={2}>
          <Typography variant="h6">{t("outfit.addItems")}</Typography>
          <AddItemsDialogSelectionSummary
            catalogCount={model.catalogCount}
            personalCount={model.personalCount}
            t={t}
          />
          <Tabs
            value={model.tab}
            onChange={(_event, value) => model.setTab(value)}
          >
            <Tab label={t("outfit.personalItems")} />
            <Tab label={t("outfit.catalog")} />
          </Tabs>
        </Stack>
      </DialogTitle>
      <DialogLoadingDivider loading={isDialogLoading} />
      <DialogContent sx={getAddItemsDialogContentSx(fullScreen)}>
        {model.tab === 0 ? (
          <AddItemsPersonalPanel locale={locale} model={model} t={t} />
        ) : null}
        {model.tab === 1 ? (
          <AddItemsCatalogPanel
            formattedTotal={catalogFormattedTotal}
            locale={locale}
            model={model}
            totalPages={catalogTotalPages}
            t={t}
          />
        ) : null}
      </DialogContent>
      <OutfitCatalogFiltersDialog
        open={model.isCatalogFiltersOpen}
        onClose={() => model.setIsCatalogFiltersOpen(false)}
        loading={model.catalogStatus.loading}
        status={model.catalogStatus}
        t={t}
        onApply={() =>
          model.applyCatalogSearch(model.catalogMobileFiltersDraftState)
        }
        onReset={model.resetCatalogSearch}
      >
        <AddItemsCatalogFilters model={model} />
      </OutfitCatalogFiltersDialog>
      <DialogActions sx={getAddItemsDialogActionsSx(fullScreen)}>
        <Button onClick={onClose}>{t("actions.cancel")}</Button>
        <Button
          variant="contained"
          disabled={!allowEmptySelection && model.selected.length === 0}
          onClick={() => onAdd(model.selected)}
        >
          {actionLabel || t("actions.add")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
