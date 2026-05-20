import type { KeyboardEvent, MouseEvent } from "react";
import {
  Box,
  Button,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import DriveFileRenameOutlineRoundedIcon from "@mui/icons-material/DriveFileRenameOutlineRounded";
import FiberManualRecordRoundedIcon from "@mui/icons-material/FiberManualRecordRounded";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import TuneRoundedIcon from "@mui/icons-material/TuneRounded";
import { useI18n } from "../../i18n/useI18n";
import { capsuleHasUnsavedChanges } from "./MainScreenHelpers";
import type { CapsuleLike } from "./MainScreenTypes";

type InlineRenameState = {
  active: boolean;
  value: string;
  setValue: (value: string) => void;
  start: () => void;
  cancel: () => void;
  submit: () => Promise<void>;
};

type HeaderProps = {
  activeCapsule?: CapsuleLike | null;
  activeName: string;
  disabled: boolean;
  inlineRename: InlineRenameState;
  isOverlay: boolean;
  selectedCount: number;
  summary: string[];
  onCancelSelection: () => void;
  onOpenFilters: () => void;
  onOpenMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onRegenerateAll: () => void;
  onRegenerateSelected: () => void;
};

function SummaryLine({ items }: { items: string[] }) {
  return (
    <Stack
      data-testid="capsule-summary"
      direction="row"
      flexWrap="wrap"
      useFlexGap
      gap={0.75}
      sx={{ color: "text.secondary", minWidth: 0 }}
    >
      {items.map((item, index) => (
        <Typography
          key={`${item}-${index}`}
          variant="body2"
          component="span"
          sx={{
            display: "inline-flex",
            gap: 0.75,
            "&::before":
              index === 0
                ? undefined
                : { content: '"•"', color: "text.disabled" },
          }}
        >
          {item}
        </Typography>
      ))}
    </Stack>
  );
}

function ActiveCapsuleUnsavedIndicator() {
  const { t } = useI18n();
  const label = t("capsule.notSaved");

  return (
    <Tooltip title={label}>
      <FiberManualRecordRoundedIcon
        aria-label={label}
        data-testid="active-capsule-unsaved-indicator"
        role="img"
        sx={{ fontSize: 10, color: "success.main" }}
      />
    </Tooltip>
  );
}

function InlineTitle({
  activeCapsule,
  activeName,
  disabled,
  inlineRename,
}: Pick<
  HeaderProps,
  "activeCapsule" | "activeName" | "disabled" | "inlineRename"
>) {
  if (inlineRename.active) {
    return (
      <TextField
        autoFocus
        variant="standard"
        value={inlineRename.value}
        disabled={disabled}
        inputProps={{ "aria-label": "Capsule name" }}
        onChange={(event) => inlineRename.setValue(event.target.value)}
        onBlur={() => void inlineRename.submit()}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault();
            void inlineRename.submit();
          } else if (event.key === "Escape") {
            event.preventDefault();
            inlineRename.cancel();
          }
        }}
        sx={{ minWidth: 0, flex: 1 }}
      />
    );
  }

  return (
    <Stack
      direction="row"
      alignItems="center"
      spacing={0.75}
      sx={inlineTitleSx}
    >
      <Box
        component="button"
        type="button"
        aria-label={`Rename capsule ${activeName}`}
        disabled={disabled}
        onClick={inlineRename.start}
        sx={{
          p: 0,
          border: 0,
          background: "transparent",
          color: "inherit",
          minWidth: 0,
        }}
      >
        <Typography variant="h6" noWrap>
          {activeName}
        </Typography>
      </Box>
      {capsuleHasUnsavedChanges(activeCapsule) ? (
        <ActiveCapsuleUnsavedIndicator />
      ) : null}
      <Box
        className="capsule-title-edit-action"
        sx={{
          width: 32,
          display: "flex",
          justifyContent: "center",
          flexShrink: 0,
          opacity: 0,
          transition: "opacity 120ms ease",
        }}
      >
        <IconButton
          aria-label="Edit capsule name"
          size="small"
          disabled={disabled}
          onClick={inlineRename.start}
        >
          <DriveFileRenameOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Box>
    </Stack>
  );
}

const inlineTitleSx = {
  minWidth: 0,
  "&:hover .capsule-title-edit-action, &:focus-within .capsule-title-edit-action":
    {
      opacity: 1,
    },
} as const;

function HeaderActions({
  disabled,
  selectedCount,
  onCancelSelection,
  onOpenMenu,
  onRegenerateAll,
  onRegenerateSelected,
}: Pick<
  HeaderProps,
  | "disabled"
  | "selectedCount"
  | "onCancelSelection"
  | "onOpenMenu"
  | "onRegenerateAll"
  | "onRegenerateSelected"
>) {
  const { t } = useI18n();
  if (selectedCount > 0) {
    return (
      <Stack
        direction="row"
        spacing={1}
        sx={{ minHeight: 40, alignItems: "center" }}
      >
        <Button
          variant="outlined"
          onClick={onCancelSelection}
          disabled={disabled}
        >
          {t("main.cancelSelection")}
        </Button>
        <Button
          variant="contained"
          onClick={onRegenerateSelected}
          disabled={disabled}
        >
          {t("main.regenerateSelected", { count: selectedCount })}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack
      direction="row"
      spacing={1}
      sx={{ minHeight: 40, alignItems: "center" }}
    >
      <Button variant="outlined" onClick={onRegenerateAll} disabled={disabled}>
        {t("capsule.regenerateAll")}
      </Button>
      <IconButton
        aria-label={t("capsule.openMenu")}
        disabled={disabled}
        onClick={onOpenMenu}
      >
        <MoreVertRoundedIcon />
      </IconButton>
    </Stack>
  );
}

function MainScreenHeader(props: HeaderProps) {
  const { t } = useI18n();
  const showTitle = !(props.isOverlay && props.selectedCount > 0);

  return (
    <>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={1}
        sx={{
          px: { xs: 2, md: 3 },
          pt: { xs: 1, md: 2.5 },
          pb: { xs: 1.5, md: 2 },
        }}
      >
        <Stack spacing={0.75} sx={{ minWidth: 0, flex: 1 }}>
          {showTitle && props.isOverlay ? (
            <IconButton
              aria-label={t("filters.open")}
              onClick={props.onOpenFilters}
              disabled={props.disabled}
              sx={{ ml: -1, alignSelf: "start" }}
            >
              <TuneRoundedIcon />
            </IconButton>
          ) : null}
          {showTitle && !props.isOverlay ? <InlineTitle {...props} /> : null}
          {!props.isOverlay ? <SummaryLine items={props.summary} /> : null}
        </Stack>
        <HeaderActions {...props} />
      </Stack>
      {props.isOverlay && props.selectedCount === 0 ? (
        <Box sx={{ px: 2, pb: 1.5 }}>
          <SummaryLine items={props.summary} />
        </Box>
      ) : null}
    </>
  );
}

export default MainScreenHeader;
