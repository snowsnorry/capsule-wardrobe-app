import { Box, Dialog, DialogActions, DialogContent } from "@mui/material";
import {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
} from "../../components/MobileDialogSurfaceStyles";
import { useI18n } from "../../i18n/useI18n";
import SearchFiltersSidebar from "../../search/SearchFiltersSidebar";
import { SearchFiltersFooter } from "../../search/SearchFiltersSidebarSections";
import { FiltersHeader } from "./StatisticsLayout";
import type { FiltersProps } from "./StatisticsLayout";

export function StatisticsFiltersDialog({
  open,
  title,
  closeLabel,
  options,
  draftState,
  status,
  onDraftStateChange,
  onApply,
  onReset,
  onClose,
}: FiltersProps & {
  open: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <Dialog
      fullScreen
      open={open}
      onClose={onClose}
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
      <FiltersHeader
        title={title}
        closeLabel={closeLabel}
        mobile
        onClose={onClose}
      />
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
            options={options}
            draftState={draftState}
            onDraftStateChange={onDraftStateChange}
            status={status}
            onApply={onApply}
            onReset={onReset}
            autoApply
            showFooterActions={false}
          />
        </Box>
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
