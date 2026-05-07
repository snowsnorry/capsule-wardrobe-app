import {
  Box,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { useI18n } from "../../i18n/useI18n";
import { isMobileCardColumns } from "./MainScreenHelpers";
import ColumnLayoutIcon from "./ColumnLayoutIcon";
import type { MobileCardColumns } from "./MainScreenTypes";

function CardLayoutMenuSection({
  show,
  disabled,
  mobileCardColumns,
  onClose,
  onMobileCardColumnsChange,
}: {
  show: boolean;
  disabled: boolean;
  mobileCardColumns: MobileCardColumns;
  onClose: () => void;
  onMobileCardColumnsChange?: (value: MobileCardColumns) => void;
}) {
  const { t } = useI18n();
  if (!show) {
    return null;
  }

  return (
    <>
      <Divider />
      <Box sx={{ px: 2, py: 1.25, display: "grid", gap: 1 }}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 700, textTransform: "uppercase" }}
        >
          {t("capsule.cardLayout")}
        </Typography>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={mobileCardColumns}
          onChange={(_event, value) => {
            if (isMobileCardColumns(value)) {
              onClose();
              onMobileCardColumnsChange?.(value);
            }
          }}
          aria-label={t("capsule.cardLayout")}
          sx={toggleButtonGroupSx}
        >
          <ToggleButton
            value={1}
            aria-label={t("capsule.cardColumnsOne")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={1} />
          </ToggleButton>
          <ToggleButton
            value={2}
            aria-label={t("capsule.cardColumnsTwo")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={2} />
          </ToggleButton>
          <ToggleButton
            value={3}
            aria-label={t("capsule.cardColumnsThree")}
            disabled={disabled}
          >
            <ColumnLayoutIcon columns={3} />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>
    </>
  );
}

const toggleButtonGroupSx = {
  alignSelf: "start",
  "& .MuiToggleButton-root": {
    minWidth: 44,
    height: 40,
    px: 1.25,
  },
} as const;

export default CardLayoutMenuSection;
