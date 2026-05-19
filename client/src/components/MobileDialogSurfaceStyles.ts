const mobileCapsuleDialogPaperSx = {
  bgcolor: "background.default",
} as const;

const mobileCapsuleDialogTitleSx = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 2,
  boxSizing: "border-box",
  minHeight: 60,
  px: 2,
  pt: 1.5,
  pb: 1,
  bgcolor: "background.paper",
  color: "text.primary",
  flexShrink: 0,
  "& > .MuiStack-root": {
    width: "100%",
  },
  "@media (min-width: 900px)": {
    px: 3,
    pt: 2.5,
    pb: 2,
  },
} as const;

const mobileCapsuleDialogContentSx = {
  bgcolor: "background.default",
  "&&": {
    pt: 1,
  },
} as const;

const mobileCapsuleDialogActionsSx = {
  bgcolor: "background.paper",
  borderTop: 1,
  borderColor: "divider",
  px: 2,
  py: 1.5,
  gap: 1,
  "@media (min-width: 900px)": {
    px: 3,
    py: 2,
  },
} as const;

export {
  mobileCapsuleDialogActionsSx,
  mobileCapsuleDialogContentSx,
  mobileCapsuleDialogPaperSx,
  mobileCapsuleDialogTitleSx,
};
