import type { ReactNode } from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Typography,
} from "@mui/material";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import { mobileCapsuleDialogActionsSx } from "../../components/MobileDialogSurfaceStyles";
import { SearchFiltersFooter } from "../../search/SearchFiltersSidebarSections";
import type { Translate } from "../../components/ProfileFiltersAnchorTypes";
import {
  catalogMobileFiltersContentSx,
  catalogMobileFiltersTitleSx,
} from "./OutfitScreenStyles";
import { DialogLoadingDivider } from "./OutfitAddItemsDialogParts";

type SearchStatus = {
  loading: boolean;
  error: string;
};

export function OutfitCatalogFiltersDialog({
  children,
  loading,
  onApply,
  onClose,
  onReset,
  open,
  status,
  t,
}: {
  children: ReactNode;
  loading: boolean;
  onApply: () => void;
  onClose: () => void;
  onReset: () => void;
  open: boolean;
  status: SearchStatus;
  t: Translate;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullScreen>
      <DialogTitle sx={catalogMobileFiltersTitleSx}>
        <Typography component="span" variant="h6">
          {t("filters.title")}
        </Typography>
        <IconButton aria-label={t("actions.close")} onClick={onClose}>
          <CloseRoundedIcon />
        </IconButton>
      </DialogTitle>
      <DialogLoadingDivider loading={loading} />
      <DialogContent sx={catalogMobileFiltersContentSx}>
        {children}
      </DialogContent>
      <DialogActions sx={mobileCapsuleDialogActionsSx}>
        <SearchFiltersFooter
          status={status}
          onApply={onApply}
          onReset={onReset}
          showApplyButton
          t={t}
        />
      </DialogActions>
    </Dialog>
  );
}
