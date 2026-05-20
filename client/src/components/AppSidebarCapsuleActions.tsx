import { IconButton, Stack, Tooltip } from "@mui/material";
import { IoCreateOutline } from "react-icons/io5";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

type Translate = (key: string) => string;

const capsulePrimaryActionButtonSx = {
  width: 32,
  height: 32,
  minWidth: 0,
  p: 0.5,
  borderRadius: "var(--cw-radius-card)",
  color: "primary.main",
} as const;

function CapsulePrimaryActions({
  capsuleChildTabIndex,
  isInteractionDisabled,
  onCreateCapsule,
  onSearchCapsules,
  t,
}: {
  capsuleChildTabIndex: number;
  isInteractionDisabled: boolean;
  onCreateCapsule?: () => Promise<void> | void;
  onSearchCapsules?: () => void;
  t: Translate;
}) {
  const newCapsuleLabel = t("capsule.new");
  const searchCapsulesLabel = t("capsule.search");

  return (
    <Stack
      className="capsule-primary-actions"
      direction="row"
      spacing={0.25}
      sx={{ ml: "auto", flexShrink: 0 }}
    >
      <Tooltip title={searchCapsulesLabel} placement="top">
        <span>
          <IconButton
            className="capsule-primary-action"
            aria-label={searchCapsulesLabel}
            tabIndex={capsuleChildTabIndex}
            disabled={isInteractionDisabled || !onSearchCapsules}
            onClick={onSearchCapsules}
            sx={capsulePrimaryActionButtonSx}
          >
            <SearchRoundedIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={newCapsuleLabel} placement="top">
        <span>
          <IconButton
            className="capsule-primary-action"
            aria-label={newCapsuleLabel}
            tabIndex={capsuleChildTabIndex}
            disabled={isInteractionDisabled || !onCreateCapsule}
            onClick={() => void onCreateCapsule?.()}
            sx={capsulePrimaryActionButtonSx}
          >
            <IoCreateOutline data-testid="IoCreateOutline" size={20} />
          </IconButton>
        </span>
      </Tooltip>
    </Stack>
  );
}

export { CapsulePrimaryActions };
