import { useState } from "react";
import {
  Box,
  Button,
  Divider,
  IconButton,
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
import type { PersonalItemsReport, WardrobeItem } from "../app/appTypes";
import { PersonalItemsReportDetails } from "./PersonalItemsReportPanelSections";
import { PersonalItemsReportSummary } from "./PersonalItemsReportSummary";
import {
  createPersonalItemsReportItemResolver,
  type PersonalItemsReportTranslate,
} from "./PersonalItemsReportPanelUtils";

type PersonalItemsReportPanelProps = {
  disabled?: boolean;
  isCompact?: boolean;
  isPending?: boolean;
  isStale?: boolean;
  items: WardrobeItem[];
  onDelete: () => void;
  onHighlightItemIds: (ids: string[]) => void;
  onRegenerate: () => void;
  report: PersonalItemsReport;
  t: PersonalItemsReportTranslate;
};

function ReportMenu({
  compact = false,
  disabled,
  onDelete,
  onRegenerate,
  t,
}: Pick<
  PersonalItemsReportPanelProps,
  "disabled" | "onDelete" | "onRegenerate" | "t"
> & { compact?: boolean }) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const close = () => setAnchor(null);

  return (
    <>
      <IconButton
        aria-label={t("wardrobe.reportOpenMenu")}
        disabled={disabled}
        onClick={(event) => setAnchor(event.currentTarget)}
        size={compact ? "small" : "medium"}
        sx={
          compact
            ? {
                height: 36,
                width: 36,
              }
            : undefined
        }
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
          <ListItemText>{t("wardrobe.regenerateReport")}</ListItemText>
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

function ReportHeader({
  compact = false,
  disabled,
  onDelete,
  onRegenerate,
  t,
}: Pick<
  PersonalItemsReportPanelProps,
  "disabled" | "onDelete" | "onRegenerate" | "t"
> & { compact?: boolean }) {
  return (
    <Box sx={{ flexShrink: 0 }}>
      <Stack
        direction="row"
        spacing={compact ? 0.75 : 1}
        sx={{
          alignItems: "center",
          px: compact ? { xs: 1.5, md: 2 } : { xs: 2, md: 2.5 },
          pt: compact ? { xs: 1.25, md: 1.75 } : { xs: 2, md: 2.5 },
          pb: compact ? 1 : 1.5,
        }}
      >
        <Typography
          variant="h6"
          sx={{
            flex: 1,
            fontSize: compact ? { xs: "1.05rem", md: "1.125rem" } : undefined,
            lineHeight: compact ? 1.25 : undefined,
          }}
        >
          {t("wardrobe.reportTitle")}
        </Typography>
        <ReportMenu
          compact={compact}
          disabled={disabled}
          onDelete={onDelete}
          onRegenerate={onRegenerate}
          t={t}
        />
      </Stack>
      <Divider
        flexItem
        sx={{ mx: compact ? { xs: 1.5, md: 2 } : { xs: 2, md: 2.5 } }}
      />
    </Box>
  );
}

function ReportBody({
  expanded,
  isCompact,
  isStale,
  items,
  onHighlightItemIds,
  onToggleExpanded,
  report,
  t,
}: Pick<
  PersonalItemsReportPanelProps,
  "isCompact" | "isStale" | "items" | "onHighlightItemIds" | "report" | "t"
> & {
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const detailsId = "personal-items-report-details";
  const resolveItems = createPersonalItemsReportItemResolver(items, t);

  return (
    <Stack
      data-testid="personal-items-report-scroll-body"
      spacing={isCompact ? 1.25 : 2.5}
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: isCompact ? "visible" : "auto",
        p: isCompact ? { xs: 1.5, md: 2 } : { xs: 2, md: 2.5 },
      }}
    >
      <PersonalItemsReportSummary
        isCompact={isCompact}
        isExpanded={expanded}
        isStale={isStale}
        report={report}
        t={t}
      />
      {isCompact ? (
        <Button
          variant="text"
          size="small"
          aria-controls={detailsId}
          aria-expanded={expanded}
          endIcon={
            expanded ? <ExpandLessRoundedIcon /> : <ExpandMoreRoundedIcon />
          }
          onClick={onToggleExpanded}
          sx={{
            alignSelf: "flex-start",
            minHeight: 36,
            mt: -0.25,
            px: 1,
          }}
        >
          {expanded
            ? t("wardrobe.reportHideDetails")
            : t("wardrobe.reportShowDetails")}
        </Button>
      ) : null}
      {expanded ? (
        <Box id={detailsId}>
          <PersonalItemsReportDetails
            onHighlightItemIds={onHighlightItemIds}
            report={report}
            resolveItems={resolveItems}
            t={t}
          />
        </Box>
      ) : null}
    </Stack>
  );
}

function PersonalItemsReportPanel({
  disabled = false,
  isCompact = false,
  isStale = false,
  items,
  onDelete,
  onHighlightItemIds,
  onRegenerate,
  report,
  t,
}: PersonalItemsReportPanelProps) {
  const [expanded, setExpanded] = useState(!isCompact);

  return (
    <Box
      data-testid="personal-items-report"
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: "var(--cw-radius-dialog)",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        height: isCompact ? "auto" : "100%",
        minHeight: 0,
        overflow: "hidden",
      }}
    >
      <ReportHeader
        compact={isCompact}
        disabled={disabled}
        onDelete={onDelete}
        onRegenerate={onRegenerate}
        t={t}
      />
      <ReportBody
        expanded={expanded}
        isCompact={isCompact}
        isStale={isStale}
        items={items}
        onHighlightItemIds={onHighlightItemIds}
        onToggleExpanded={() => setExpanded((current) => !current)}
        report={report}
        t={t}
      />
    </Box>
  );
}

export default PersonalItemsReportPanel;
