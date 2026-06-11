import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

type ReportTone = "success" | "warning" | "error" | "neutral";

const reportToneSx = {
  success: {
    color: "success.dark",
    backgroundColor: "rgba(47, 143, 88, 0.12)",
    markerColor: "success.main",
  },
  warning: {
    color: "warning.dark",
    backgroundColor: "rgba(182, 132, 22, 0.16)",
    markerColor: "warning.main",
  },
  error: {
    color: "error.main",
    backgroundColor: "rgba(210, 67, 67, 0.12)",
    markerColor: "error.main",
  },
  neutral: {
    color: "text.secondary",
    backgroundColor: "action.selected",
    markerColor: "text.secondary",
  },
} as const;

function getScoreTone(score: number | null): ReportTone {
  if (score === null) return "neutral";
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

function ReportSection({
  children,
  icon,
  title,
}: {
  children: ReactNode;
  icon?: ReactNode;
  title: string;
}) {
  return (
    <Stack spacing={1.25}>
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        {icon ? (
          <Box
            sx={{
              display: "grid",
              flexShrink: 0,
              height: 20,
              placeItems: "center",
              width: 20,
            }}
          >
            {icon}
          </Box>
        ) : null}
        <Typography variant="subtitle1" sx={{ fontWeight: 750 }}>
          {title}
        </Typography>
      </Stack>
      {children}
    </Stack>
  );
}

function TextList({
  items,
  tone = "success",
}: {
  items: string[] | null | undefined;
  tone?: ReportTone;
}) {
  const values = (items || []).filter(Boolean);
  if (!values.length) return null;

  return (
    <Stack
      component="ul"
      spacing={0.75}
      sx={{
        listStyle: "none",
        m: 0,
        p: 0,
      }}
    >
      {values.map((item) => (
        <Box
          key={item}
          component="li"
          sx={{
            columnGap: 1,
            display: "grid",
            gridTemplateColumns: "20px minmax(0, 1fr)",
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
          <Typography variant="body2" sx={{ lineHeight: 1.55 }}>
            {item}
          </Typography>
        </Box>
      ))}
    </Stack>
  );
}

function HighlightRow({
  asListItem = false,
  children,
  ids,
  onHighlightItemIds,
  tone,
}: {
  asListItem?: boolean;
  children: ReactNode;
  ids: string[];
  onHighlightItemIds: (ids: string[]) => void;
  tone?: ReportTone;
}) {
  const hasTargets = ids.length > 0;
  const highlightHandlers = {
    onBlur: () => onHighlightItemIds([]),
    onFocus: () => onHighlightItemIds(ids),
    onMouseEnter: () => onHighlightItemIds(ids),
    onMouseLeave: () => onHighlightItemIds([]),
  };
  const focusVisibleSx = hasTargets
    ? {
        boxShadow: "0 0 0 2px var(--cw-color-primary)",
      }
    : undefined;
  const content = (
    <Box
      sx={{
        borderRadius: "var(--cw-radius-card)",
        lineHeight: 1.55,
        mx: -0.75,
        p: 0.75,
      }}
    >
      {children}
    </Box>
  );

  if (asListItem) {
    return (
      <Box
        component="li"
        tabIndex={hasTargets ? 0 : undefined}
        {...highlightHandlers}
        sx={{
          columnGap: 1,
          display: "grid",
          gridTemplateColumns: "20px minmax(0, 1fr)",
          listStyle: "none",
          outline: "none",
          "&:focus-visible": focusVisibleSx,
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            alignSelf: "start",
            bgcolor: reportToneSx[tone || "success"].markerColor,
            borderRadius: "var(--cw-radius-pill)",
            height: 5,
            justifySelf: "center",
            mt: "1.02em",
            width: 5,
          }}
        />
        {content}
      </Box>
    );
  }

  return (
    <Box
      tabIndex={hasTargets ? 0 : undefined}
      {...highlightHandlers}
      sx={{
        outline: "none",
        "&:focus-visible": focusVisibleSx,
      }}
    >
      {content}
    </Box>
  );
}

export { getScoreTone, HighlightRow, ReportSection, reportToneSx, TextList };
export type { ReportTone };
