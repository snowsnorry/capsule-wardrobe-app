import { Box, Button } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";

type Translate = (key: string) => string;

const capsulePrimaryActionSx = {
  justifyContent: "flex-start",
  minHeight: 44,
  ml: -1.5,
  pl: 1.5,
  pr: 0,
  borderRadius: 999,
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
  return (
    <>
      <Button
        variant="text"
        tabIndex={capsuleChildTabIndex}
        disabled={isInteractionDisabled || !onCreateCapsule}
        onClick={() => void onCreateCapsule?.()}
        sx={capsulePrimaryActionSx}
      >
        <AddRoundedIcon sx={{ mr: 2.2 }} />
        <Box component="span" sx={{ fontWeight: 550 }}>
          {t("capsule.new")}
        </Box>
      </Button>
      <Button
        variant="text"
        tabIndex={capsuleChildTabIndex}
        disabled={isInteractionDisabled || !onSearchCapsules}
        onClick={onSearchCapsules}
        sx={capsulePrimaryActionSx}
      >
        <SearchRoundedIcon sx={{ mr: 2.2 }} />
        <Box component="span" sx={{ fontWeight: 550 }}>
          {t("capsule.search")}
        </Box>
      </Button>
    </>
  );
}

export { CapsulePrimaryActions };
