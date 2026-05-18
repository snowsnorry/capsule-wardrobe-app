const settingsDialogPaperSx = {
  height: { sm: 700 },
  maxHeight: { xs: "calc(100dvh - 32px)", sm: "calc(100dvh - 64px)" },
} as const;

const settingsDialogContentSx = {
  pt: 1,
  pb: 0,
  flex: "1 1 auto",
  minHeight: 0,
  overflow: "hidden",
} as const;

const settingsDialogBodySx = {
  display: "grid",
  gridTemplateColumns: { xs: "1fr", sm: "220px minmax(0, 1fr)" },
  gridTemplateRows: { xs: "auto minmax(0, 1fr)", sm: "1fr" },
  gap: 3,
  height: "100%",
  overflow: "hidden",
  minHeight: { xs: 0, sm: 320 },
} as const;

const settingsDialogMainPanelSx = {
  minWidth: 0,
  minHeight: 0,
  overflowY: "auto",
  pr: 0.5,
} as const;

export {
  settingsDialogBodySx,
  settingsDialogContentSx,
  settingsDialogMainPanelSx,
  settingsDialogPaperSx,
};
