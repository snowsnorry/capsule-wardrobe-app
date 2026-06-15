import { Box, Stack, Typography } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import type { CapsuleReport } from "../../app/appTypes";
import {
  ReportSection,
  reportToneSx,
} from "../outfitScreen/OutfitReportPanelSectionPrimitives";
import {
  getCapsuleGeneratedOutfitsOverview,
  getCapsuleOverviewLines,
  getCapsuleWeakOutfitOverviewRows,
  type CapsuleReportTranslate,
  type CapsuleReportWeakOutfitOverviewRow,
} from "./CapsuleReportPanelUtils";

const reportListTextSx = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
} as const;

const overviewListSx = {
  listStyle: "none",
  m: 0,
  p: 0,
} as const;

const overviewBulletSx = {
  columnGap: 1,
  display: "grid",
  gridTemplateColumns: "20px minmax(0, 1fr)",
} as const;

const overviewMarkerSx = {
  alignSelf: "start",
  bgcolor: reportToneSx.neutral.markerColor,
  borderRadius: "var(--cw-radius-pill)",
  height: 5,
  justifySelf: "center",
  mt: "0.58em",
  width: 5,
} as const;

function WeakOutfitRows({
  rows,
  t,
}: {
  rows: CapsuleReportWeakOutfitOverviewRow[];
  t: CapsuleReportTranslate;
}) {
  return (
    <Stack
      component="ul"
      data-testid="capsule-report-weak-outfits"
      spacing={0.5}
      sx={{ listStyle: "disc", mt: 0.5, pl: 2.5 }}
    >
      {rows.map((row) => (
        <Typography
          key={row.key}
          component="li"
          data-testid="capsule-report-weak-outfit"
          variant="body2"
          sx={reportListTextSx}
        >
          <Box component="span" sx={{ fontWeight: 750 }}>
            {row.outfitLabel}:
          </Box>{" "}
          {row.issue}
          {row.suggestion ? (
            <Box
              component="span"
              data-testid="capsule-report-weak-outfit-suggestion"
              sx={{ display: "block", mt: 0.25 }}
            >
              <Box component="span" sx={{ fontWeight: 750 }}>
                {t("capsule.reportIssueSuggestionLabel")}
              </Box>{" "}
              {row.suggestion}
            </Box>
          ) : null}
        </Typography>
      ))}
    </Stack>
  );
}

function OverviewBullet({
  line,
  showWeakOutfits,
  t,
  weakOutfitRows,
}: {
  line: string;
  showWeakOutfits: boolean;
  t: CapsuleReportTranslate;
  weakOutfitRows: CapsuleReportWeakOutfitOverviewRow[];
}) {
  return (
    <Box component="li" sx={overviewBulletSx}>
      <Box aria-hidden="true" sx={overviewMarkerSx} />
      <Box>
        <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
          {line}
        </Typography>
        {showWeakOutfits ? (
          <WeakOutfitRows rows={weakOutfitRows} t={t} />
        ) : null}
      </Box>
    </Box>
  );
}

function CapsuleReportPanelOverviewSection({
  report,
  t,
}: {
  report: CapsuleReport;
  t: CapsuleReportTranslate;
}) {
  const lines = getCapsuleOverviewLines(report, t);
  const generatedOverview = getCapsuleGeneratedOutfitsOverview(report, t);
  const generatedOverviewIndex = generatedOverview
    ? lines.indexOf(generatedOverview)
    : -1;
  const weakOutfitRows = getCapsuleWeakOutfitOverviewRows(report, t);
  if (!lines.length) return null;

  return (
    <ReportSection
      title={t("capsule.reportOverview")}
      icon={<InfoOutlinedIcon color="primary" fontSize="small" />}
    >
      <Stack component="ul" spacing={0.75} sx={overviewListSx}>
        {lines.map((line, index) => (
          <OverviewBullet
            key={`${line}-${index}`}
            line={line}
            showWeakOutfits={
              index === generatedOverviewIndex && weakOutfitRows.length > 0
            }
            t={t}
            weakOutfitRows={weakOutfitRows}
          />
        ))}
      </Stack>
    </ReportSection>
  );
}

export default CapsuleReportPanelOverviewSection;
