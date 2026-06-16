import type { MouseEvent, ReactNode } from "react";
import {
  ListItemIcon,
  MenuItem,
  type SxProps,
  type Theme,
} from "@mui/material";

type ActionMenuItemProps = {
  disabled?: boolean;
  icon?: ReactNode;
  reserveIconSpace?: boolean;
  onAction: () => void;
  onClose: () => void;
  sx?: SxProps<Theme>;
  children: ReactNode;
};

export default function ActionMenuItem({
  disabled = false,
  icon = null,
  reserveIconSpace = false,
  onAction,
  onClose,
  sx,
  children,
}: ActionMenuItemProps) {
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    event.currentTarget.blur();
    onClose();
    onAction();
  };

  return (
    <MenuItem disabled={disabled} onClick={handleClick} sx={sx}>
      <ListItemIcon
        sx={reserveIconSpace ? { visibility: "hidden" } : undefined}
      >
        {icon}
      </ListItemIcon>
      {children}
    </MenuItem>
  );
}
