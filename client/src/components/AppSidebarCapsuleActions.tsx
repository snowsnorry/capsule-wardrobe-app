import { Box, Button } from "@mui/material";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import {
  expandedTopLevelIconShift,
  topLevelIconRailWidth,
} from "./AppSidebarNavigationParts";

type Translate = (key: string) => string;

const capsulePrimaryActionSx = {
  justifyContent: "flex-start",
  minHeight: 44,
  width: "100%",
  minWidth: 0,
  px: 0,
  borderRadius: "8px",
  color: "primary.main",
} as const;

const capsulePrimaryActionIconSx = {
  width: topLevelIconRailWidth,
  display: "flex",
  justifyContent: "center",
  flexShrink: 0,
  transform: `translateX(${expandedTopLevelIconShift})`,
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
        <Box
          className="capsule-primary-action-icon"
          sx={capsulePrimaryActionIconSx}
        >
          <AddRoundedIcon />
        </Box>
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
        <Box
          className="capsule-primary-action-icon"
          sx={capsulePrimaryActionIconSx}
        >
          <SearchRoundedIcon />
        </Box>
        <Box component="span" sx={{ fontWeight: 550 }}>
          {t("capsule.search")}
        </Box>
      </Button>
    </>
  );
}

export { CapsulePrimaryActions };
