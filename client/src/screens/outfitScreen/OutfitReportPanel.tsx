import { useState } from "react";
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Typography,
} from "@mui/material";
import DeleteOutlineRoundedIcon from "@mui/icons-material/DeleteOutlineRounded";
import ExpandLessRoundedIcon from "@mui/icons-material/ExpandLessRounded";
import ExpandMoreRoundedIcon from "@mui/icons-material/ExpandMoreRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import type { OutfitReport } from "../../app/appTypes";
import { ReportDetails, ReportSummary } from "./OutfitReportPanelSections";
import type { OutfitReportTranslate } from "./OutfitReportPanelUtils";

type OutfitReportPanelProps = {
  disabled?: boolean;
  isCompact?: boolean;
  isPending?: boolean;
  isStale?: boolean;
  onDelete: () => void;
  onHighlightItemIds: (ids: string[]) => void;
  onRegenerate: () => void;
  report: OutfitReport;
  t: OutfitReportTranslate;
};

function ReportMenu({
  disabled,
  onDelete,
  onRegenerate,
  t,
}: Pick<
  OutfitReportPanelProps,
  "disabled" | "onDelete" | "onRegenerate" | "t"
>) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label={t("outfit.reportOpenMenu")}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <MoreVertRoundedIcon />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close}>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            close();
            onRegenerate();
          }}
        >
          <ListItemIcon>
            <RefreshRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("outfit.regenerateReport")}</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={disabled}
          onClick={() => {
            close();
            onDelete();
          }}
          sx={{
            color: "error.main",
            "& .MuiListItemIcon-root": { color: "inherit" },
          }}
        >
          <ListItemIcon>
            <DeleteOutlineRoundedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("actions.delete")}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}

export default function OutfitReportPanel({
  disabled = false,
  isCompact = false,
  isPending = false,
  isStale = false,
  onDelete,
  onHighlightItemIds,
  onRegenerate,
  report,
  t,
}: OutfitReportPanelProps) {
  const [expanded, setExpanded] = useState(!isCompact);
  const detailsId = "outfit-report-details";

  return (
    <Box
      data-testid="outfit-report"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--cw-radius-dialog)",
        bgcolor: "background.paper",
        overflow: "hidden",
      }}
    >
      {isPending ? (
        <LinearProgress
          aria-label={t("outfit.reportGenerating")}
          color="success"
        />
      ) : null}
      <Stack spacing={2.5} sx={{ p: { xs: 2, md: 2.5 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Typography variant="h5" sx={{ flex: 1 }}>
            {t("outfit.reportTitle")}
          </Typography>
          <ReportMenu
            disabled={disabled}
            onDelete={onDelete}
            onRegenerate={onRegenerate}
            t={t}
          />
        </Stack>
        <ReportSummary isStale={isStale} report={report} t={t} />
        {isCompact ? (
          <Button
            variant="text"
            size="small"
            aria-controls={detailsId}
            aria-expanded={expanded}
            endIcon={
              expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />
            }
            onClick={() => setExpanded((current) => !current)}
            sx={{ alignSelf: "flex-start" }}
          >
            {expanded
              ? t("outfit.reportHideDetails")
              : t("outfit.reportShowDetails")}
          </Button>
        ) : null}
        {expanded ? (
          <Box id={detailsId}>
            <ReportDetails
              onHighlightItemIds={onHighlightItemIds}
              report={report}
              t={t}
            />
          </Box>
        ) : null}
      </Stack>
    </Box>
  );
}
