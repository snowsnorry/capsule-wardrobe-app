import { Box, LinearProgress, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import type { PersonalItemsReport } from "../app/appTypes";
import {
  getScoreTone,
  HighlightRow,
  reportToneSx,
  type ReportTone,
} from "./outfitScreen/OutfitReportPanelSectionPrimitives";
import {
  formatReportValue,
  joinItemReferenceLabels,
  toPercent,
  type ItemReferenceResolver,
  type PersonalItemsReportTranslate,
} from "./PersonalItemsReportPanelUtils";

type ReportContentProps = {
  onHighlightItemIds: (ids: string[]) => void;
  report: PersonalItemsReport;
  resolveItems: ItemReferenceResolver;
  t: PersonalItemsReportTranslate;
};

type ValueRow = {
  key: string;
  label: string;
  value: unknown;
};

const reportListTextSx = {
  fontSize: "0.875rem",
  lineHeight: 1.55,
} as const;

function hasText(value: unknown) {
  return String(value ?? "").trim().length > 0;
}

function hasItems(value: unknown) {
  return Array.isArray(value) && value.filter(hasText).length > 0;
}

function percentLabel(value: unknown) {
  const percent = toPercent(value);
  return percent === null ? "" : `${percent}%`;
}

function optionalRow(
  key: string,
  label: string,
  value: unknown,
): ValueRow | null {
  if (Array.isArray(value)) {
    return hasItems(value) ? { key, label, value } : null;
  }
  return hasText(value) ? { key, label, value } : null;
}

function compactValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.filter(hasText).map(formatReportValue).join(", ");
  }
  if (typeof value === "number") {
    return percentLabel(value) || String(value);
  }
  if (typeof value === "string" && /^[a-z0-9_]+$/i.test(value)) {
    return formatReportValue(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return formatReportValue(value);
}

function ValueRows({ rows }: { rows: Array<ValueRow | null> }) {
  const visibleRows = rows.filter((row): row is ValueRow => Boolean(row));
  if (!visibleRows.length) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gap: 0.75,
        gridTemplateColumns: {
          xs: "1fr",
          sm: "minmax(132px, max-content) 1fr",
        },
      }}
    >
      {visibleRows.map((row) => (
        <Box key={row.key} sx={{ display: "contents" }}>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontWeight: 700 }}
          >
            {row.label}
          </Typography>
          <Typography variant="body2" sx={reportListTextSx}>
            {compactValue(row.value)}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function ScoreRows({
  rows,
}: {
  rows: Array<{ key: string; label: string; percent: number | null }>;
}) {
  if (!rows.length) return null;

  return (
    <Box
      sx={{
        alignItems: "center",
        columnGap: 1.5,
        display: "grid",
        gridTemplateColumns: "max-content minmax(96px, 1fr) max-content",
        rowGap: 1.25,
      }}
    >
      {rows.map((row) => {
        const tone = getScoreTone(row.percent);
        return (
          <Box key={row.key} sx={{ display: "contents" }}>
            <Typography variant="body2" noWrap>
              {row.label}
            </Typography>
            <LinearProgress
              aria-label={row.label}
              variant="determinate"
              value={row.percent || 0}
              sx={{
                width: "100%",
                height: 6,
                borderRadius: "var(--cw-radius-pill)",
                bgcolor: "divider",
                "& .MuiLinearProgress-bar": {
                  bgcolor: reportToneSx[tone].markerColor,
                  borderRadius: "var(--cw-radius-pill)",
                },
              }}
            />
            <Typography
              variant="body2"
              sx={{
                color: reportToneSx[tone].color,
                fontWeight: 750,
                minWidth: 42,
                textAlign: "right",
              }}
            >
              {row.percent}%
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function Notes({ value }: { value: string | null | undefined }) {
  if (!hasText(value)) return null;
  return (
    <Typography
      variant="body2"
      sx={{ ...reportListTextSx, color: "text.secondary" }}
    >
      {value}
    </Typography>
  );
}

function RelatedItems({
  ids,
  resolveItems,
  t,
}: {
  ids: string[] | null | undefined;
  resolveItems: ItemReferenceResolver;
  t: PersonalItemsReportTranslate;
}) {
  const references = resolveItems(ids);
  if (!references.length) return null;

  return (
    <Typography
      data-testid="personal-items-report-related-items"
      variant="body2"
      sx={{ color: "text.secondary", fontSize: "0.8rem", lineHeight: 1.45 }}
    >
      <Box component="span" sx={{ fontWeight: 750 }}>
        {t("wardrobe.reportRelatedItems")}
      </Box>{" "}
      {joinItemReferenceLabels(references)}
    </Typography>
  );
}

function ReferenceRows({
  onHighlightItemIds,
  resolveItems,
  rows,
  t,
  title,
  tone,
}: {
  onHighlightItemIds: (ids: string[]) => void;
  resolveItems: ItemReferenceResolver;
  rows: Array<{ ids: string[]; key: string; message: string; prefix?: string }>;
  t: PersonalItemsReportTranslate;
  title: string;
  tone?: ReportTone;
}) {
  const visibleRows = rows.filter(
    (row) => hasText(row.message) || row.ids.length,
  );
  if (!visibleRows.length) return null;

  return (
    <Stack spacing={0.75}>
      <Typography variant="body2" sx={{ fontWeight: 750 }}>
        {title}
      </Typography>
      <Stack
        component="ul"
        spacing={0.5}
        sx={{ listStyle: "none", m: 0, p: 0 }}
      >
        {visibleRows.map((row) => (
          <HighlightRow
            asListItem
            key={row.key}
            ids={row.ids}
            onHighlightItemIds={onHighlightItemIds}
            tone={tone}
          >
            <Stack spacing={0.35}>
              <Typography variant="body2" sx={reportListTextSx}>
                {row.prefix ? (
                  <Box component="span" sx={{ fontWeight: 750 }}>
                    {row.prefix}:{" "}
                  </Box>
                ) : null}
                {row.message}
              </Typography>
              <RelatedItems ids={row.ids} resolveItems={resolveItems} t={t} />
            </Stack>
          </HighlightRow>
        ))}
      </Stack>
    </Stack>
  );
}

function SeverityListItem({
  children,
  tone,
}: {
  children: ReactNode;
  tone: ReportTone;
}) {
  return (
    <Box
      component="li"
      sx={{
        columnGap: 1,
        display: "grid",
        gridTemplateColumns: "20px minmax(0, 1fr)",
        listStyle: "none",
      }}
    >
      <Box
        aria-hidden="true"
        sx={{
          alignSelf: "start",
          bgcolor: reportToneSx[tone].markerColor,
          borderRadius: "var(--cw-radius-pill)",
          height: 5,
          justifySelf: "center",
          mt: "0.58em",
          width: 5,
        }}
      />
      {children}
    </Box>
  );
}

function severityToTone(value: unknown): ReportTone {
  const severity = String(value || "").toLowerCase();
  if (severity === "critical") return "error";
  if (severity === "warning") return "warning";
  return "neutral";
}

export type { ReportContentProps };

export {
  hasText,
  Notes,
  optionalRow,
  percentLabel,
  ReferenceRows,
  RelatedItems,
  reportListTextSx,
  ScoreRows,
  SeverityListItem,
  severityToTone,
  ValueRows,
};
